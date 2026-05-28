export default async function handler(req, res) {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(200).json({
      keyFound: false,
      message: 'GEMINI_API_KEY is NOT set in Vercel environment variables'
    });
  }

  // Try to list available models
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`
    );
    const listData = await listRes.json();

    if (!listRes.ok) {
      return res.status(200).json({
        keyFound: true,
        keyLength: geminiKey.length,
        listModelsError: listData.error?.message || 'Unknown error',
        status: listRes.status
      });
    }

    const models = (listData.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));

    // Try a quick test call with the first available model
    const testModel = models[0];
    let testResult = 'not tested';

    if (testModel) {
      const testRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Say "OK" in one word.' }] }],
            generationConfig: { maxOutputTokens: 10 }
          })
        }
      );
      testResult = testRes.ok ? 'SUCCESS' : `FAILED (${testRes.status})`;
    }

    return res.status(200).json({
      keyFound: true,
      keyPrefix: geminiKey.substring(0, 8) + '...',
      availableModels: models,
      bestModel: testModel || 'none found',
      testCallResult: testResult
    });

  } catch (err) {
    return res.status(200).json({
      keyFound: true,
      error: err.message
    });
  }
}
