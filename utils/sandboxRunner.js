const axios = require('axios');

const executeCodeInSandbox = async (sourceCode, languageId, stdin) => {
    const options = {
        method: 'POST',
        url: `${process.env.RAPIDAPI_JUDGE0_URL}/submissions`,
        params: {
            base64_encoded: 'true',
            wait: 'true', // Wait for the result
        },
        headers: {
            'content-type': 'application/json',
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
        },
        data: {
            language_id: languageId,
            source_code: Buffer.from(sourceCode).toString('base64'),
            stdin: Buffer.from(stdin || '').toString('base64'),
        },
    };

    try {
        const response = await axios.request(options);
        return response.data;
    } catch (error) {
        console.error('Judge0 API Error:', error.response ? error.response.data : error.message);
        throw new Error('Error executing code in sandbox');
    }
};

module.exports = { executeCodeInSandbox };