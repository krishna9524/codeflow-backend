const express = require('express');
const router = express.Router();
const axios = require('axios');

// Helper to extract meta tags
const extractMeta = (html, property) => {
    const regex = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
    const match = regex.exec(html);
    if (match) return match[1];
    // Try 'name' attribute if 'property' fails
    const regexName = new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
    const matchName = regexName.exec(html);
    return matchName ? matchName[1] : null;
};

router.get('/metadata', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ msg: 'URL is required' });

    try {
        // Pretend to be a browser to avoid 403 Forbidden
        const { data: html } = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 
            },
            timeout: 5000 
        });

        const metadata = {
            title: extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title'),
            description: extractMeta(html, 'og:description') || extractMeta(html, 'twitter:description'),
            image: extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image'),
            domain: new URL(url).hostname.replace('www.', '')
        };

        // Fallback for Title
        if (!metadata.title) {
            const titleMatch = /<title>(.*?)<\/title>/i.exec(html);
            if (titleMatch) metadata.title = titleMatch[1];
        }

        res.json(metadata);
    } catch (err) {
        console.error("Meta Fetch Error:", err.message);
        // Return null data instead of crashing so frontend just hides the card
        res.json({}); 
    }
});

module.exports = router;