const OpenAI = require('openai');

// Rate limiting storage 
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 10; 

// Available models on Groq
const AVAILABLE_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-insruct", // The primary Llama 4 model
  "llama-3.3-70b-versatile",                  // Highly capable fallback
  "llama-3.1-8b-instant"                      // Lightning-fast fallback
];

exports.getAiHelp = async (req, res) => {
    // 1. DYNAMIC API KEY CHECK: Looking for GROQ_API_KEY
    if (!process.env.GROQ_API_KEY) {
        console.error("CRITICAL ERROR: GROQ_API_KEY is missing from .env file!");
        return res.status(500).json({ msg: "Server misconfiguration: Missing Groq API Key." });
    }

    // 2. Connect to Groq using the OpenAI SDK
    const openai = new OpenAI({
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: process.env.GROQ_API_KEY, 
    });

    const { 
        userMessage, 
        conversationHistory = [], 
        currentContext = {} 
    } = req.body;

    if (!userMessage || typeof userMessage !== 'string') {
        return res.status(400).json({ msg: 'User message is required.' });
    }

    // 3. RATE LIMITING LOGIC
    const userId = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;
    
    for (let [key, timestamp] of rateLimitStore.entries()) {
        if (timestamp < windowStart) rateLimitStore.delete(key);
    }
    
    const userRequests = Array.from(rateLimitStore.entries())
        .filter(([key, timestamp]) => key.startsWith(userId) && timestamp > windowStart);
    
    if (userRequests.length >= MAX_REQUESTS_PER_MINUTE) {
        return res.status(429).json({ 
            msg: `Rate limit exceeded. Please wait a moment before trying again.`,
            error: 'Rate limit exceeded',
        });
    }
    
    rateLimitStore.set(`${userId}-${now}`, now);

    try {
        // 4. BUILD THE SYSTEM PROMPT
        const messages = [
            {
                role: 'system',
                content: `You are CodeFlow AI - an expert programming tutor. 
                
                **STRICT RULES:**
                1. NEVER provide complete corrected code solutions - give hints and explain approaches.
                2. If the user asks about test cases, ONLY explain the EXACT test cases provided in the context below. Do not make up random test cases.
                3. If the user asks why their code is failing, look at the "LATEST EXECUTION RESULT" below to see exactly which test case failed and why.
                4. Keep responses concise, friendly, and formatted beautifully with markdown.
                
                **Current Context:**
                - Problem: ${currentContext.problemTitle || 'Unknown'}
                - Language: ${currentContext.language || 'Any'}
                - Problem Description: ${currentContext.problemDescription || 'Not provided'}
                - Actual Problem Test Cases: ${JSON.stringify(currentContext.testCases || 'Not provided')}
                
                ${currentContext.lastResult ? `\n**LATEST EXECUTION RESULT (Why it failed):**\n${JSON.stringify(currentContext.lastResult)}` : ''}

                ${currentContext.code ? `\n**User's Current Code:**\n\`\`\`${currentContext.language}\n${currentContext.code}\n\`\`\`` : ''}`
            }
        ];

        // 5. GROQ DUPLICATE MESSAGE SAFEGUARD
        const recentHistory = conversationHistory.slice(-5);
        recentHistory.forEach(entry => {
            // Filter out exact duplicates of the current message
            if (entry.role && entry.content && entry.content !== userMessage) {
                messages.push({ role: entry.role, content: entry.content });
            }
        });

        // Ensure we don't accidentally send two 'user' messages in a row (Groq hates this)
        if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
            messages.push({ role: 'assistant', content: 'Understood. Please continue.' });
        }

        // Finally, add the current user message
        messages.push({ role: 'user', content: userMessage });

        console.log("Groq AI Request initiated for user:", userId);

        // 6. MODEL FALLBACK SYSTEM
        let lastError = null;
        
        for (const model of AVAILABLE_MODELS) {
            try {
                console.log(`Attempting Groq connection with model: ${model}`);
                
                const completion = await openai.chat.completions.create({
                    model: model,
                    messages: messages,
                    max_tokens: 1500, 
                    temperature: 0.7,
                });

                const aiResponse = completion.choices[0].message.content;
                
                console.log(`Success! Responded using Groq model: ${model}`);
                return res.json({ 
                    help: aiResponse,
                    modelUsed: model
                });
                
            } catch (error) {
                console.log(`Groq Model ${model} failed:`, error.message);
                lastError = error;
                
                if (error.status === 401) break; // Break on Auth failure
                continue; 
            }
        }

        throw lastError;

    } catch (error) {
        console.error("All Groq models failed:", error);
        rateLimitStore.delete(`${userId}-${now}`); 
        
        if (error.status === 401 || (error.response && error.response.status === 401)) {
            return res.status(500).json({ 
                msg: 'Groq API authentication failed (Invalid API Key). Check server logs.',
                error: 'Internal Configuration Error'
            });
        }

        res.status(500).json({ 
            msg: 'AI services are currently unavailable. Please try again later.',
            error: 'Service unavailable'
        });
    }
};