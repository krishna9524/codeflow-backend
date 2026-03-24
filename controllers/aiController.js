const OpenAI = require('openai');

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 5; // Free tier limit

// Available models for fallback (Using highly capable free models)
const AVAILABLE_MODELS = [
  "google/gemini-2.0-flash-lite-preview-02-05:free", // Usually the fastest and most stable
  "qwen/qwen-2.5-coder-32b-instruct:free",           // Built specifically for coding
  "meta-llama/llama-3.1-8b-instruct:free",           // Extremely reliable Llama version
  "microsoft/phi-3-mini-128k-instruct:free",         // Microsoft's model (rarely goes down)
  "huggingfaceh4/zephyr-7b-beta:free"                // The ultimate fallback (almost never 404s)
];

exports.getAiHelp = async (req, res) => {
    // 1. DYNAMIC API KEY CHECK: Ensures we never fail due to load order
    if (!process.env.OPENROUTER_API_KEY) {
        console.error("CRITICAL ERROR: OPENROUTER_API_KEY is missing from .env file!");
        return res.status(500).json({ msg: "Server misconfiguration: Missing AI API Key." });
    }

    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY, 
        defaultHeaders: {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "CodeFlow",
        },
    });

    const { 
        userMessage, 
        conversationHistory = [], 
        currentContext = {} 
    } = req.body;

    if (!userMessage || typeof userMessage !== 'string') {
        return res.status(400).json({ msg: 'User message is required.' });
    }

    // 2. RATE LIMITING LOGIC
    const userId = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;
    
    // Clean old entries
    for (let [key, timestamp] of rateLimitStore.entries()) {
        if (timestamp < windowStart) {
            rateLimitStore.delete(key);
        }
    }
    
    // Check limit
    const userRequests = Array.from(rateLimitStore.entries())
        .filter(([key, timestamp]) => key.startsWith(userId) && timestamp > windowStart);
    
    if (userRequests.length >= MAX_REQUESTS_PER_MINUTE) {
        return res.status(429).json({ 
            msg: `Rate limit exceeded. Please wait a moment before trying again.`,
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((userRequests[0][1] + RATE_LIMIT_WINDOW - now) / 1000)
        });
    }
    
    rateLimitStore.set(`${userId}-${now}`, now);

    try {
        // 3. BUILD THE SYSTEM PROMPT
        // 3. BUILD THE SYSTEM PROMPT
        const messages = [
            {
                role: 'system',
                content: `You are CodeFlow AI - an elite programming tutor. 
                You help with ALL programming problems, algorithms, data structures, and coding concepts.

                **RESPONSE RULES:**
                1. **NEVER** give the full completed code immediately. Give hints, pseudocode, and explain the logic so the user learns.
                2. Keep responses concise and formatted beautifully with markdown.
                3. Point out specific line numbers or exact bugs in their provided code if they ask why it's failing.
                
                **--- THE PROBLEM THE USER IS SOLVING ---**
                Title: ${currentContext.problemTitle || 'Unknown'}
                Description: ${currentContext.problemDescription || 'Not provided'}
                Test Cases: ${JSON.stringify(currentContext.testCases || 'Not provided')}
                
                **--- THE USER'S CURRENT WORK ---**
                Language: ${currentContext.language || 'Any'}
                Code:
                \`\`\`${currentContext.language || 'text'}
                ${currentContext.code ? currentContext.code : '// User has not written any code yet.'}
                \`\`\``
            }
        ];

        // Add history (limit to last 5)
        const recentHistory = conversationHistory.slice(-5);
        recentHistory.forEach(entry => {
            if (entry.role && entry.content) {
                messages.push({ role: entry.role, content: entry.content });
            }
        });

        // Add current user message
        messages.push({ role: 'user', content: userMessage });

        console.log("AI Request initiated for user:", userId);

        // 4. MODEL FALLBACK SYSTEM
        let lastError = null;
        
        for (const model of AVAILABLE_MODELS) {
            try {
                console.log(`Attempting AI connection with model: ${model}`);
                
                const completion = await openai.chat.completions.create({
                    model: model,
                    messages: messages,
                    max_tokens: 1500, 
                    temperature: 0.7,
                });

                const aiResponse = completion.choices[0].message.content;
                
                console.log(`Success! Responded using model: ${model}`);
                return res.json({ 
                    help: aiResponse,
                    modelUsed: model
                });
                
            } catch (error) {
                console.log(`Model ${model} failed:`, error.message);
                lastError = error;
                
                // If auth fails, break immediately to avoid spamming the API
                if (error.status === 401) break;
                
                // Otherwise, try the next model in the array
                continue; 
            }
        }

        // If all models failed, throw the last error to be caught by the catch block below
        throw lastError;

    } catch (error) {
        console.error("All AI models failed:", error);
        rateLimitStore.delete(`${userId}-${now}`); // Free up rate limit on failure
        
        // Handle Invalid API Key explicitly
        if (error.status === 401 || (error.response && error.response.status === 401)) {
            return res.status(500).json({ 
                msg: 'AI service authentication failed (Invalid API Key). Check server logs.',
                error: 'Internal Configuration Error'
            });
        }

        if (error.status === 429 || error.code === 'insufficient_quota') {
            return res.status(429).json({ 
                msg: 'All AI services are currently busy. Please try again in a few minutes.',
                error: 'Service temporarily unavailable'
            });
        }

        res.status(500).json({ 
            msg: 'AI services are currently unavailable. Please try again later.',
            error: 'Service unavailable'
        });
    }
};