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
    let testError = null;

    if (testModel) {
      const testRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Identify this: plastic bottle' }] }],
            systemInstruction: { parts: [{ text: 'You are an environmental analyzer.' }] },
            generationConfig: { maxOutputTokens: 10 }
          })
        }
      );
      if (testRes.ok) {
        testResult = 'SUCCESS';
      } else {
        const errData = await testRes.json().catch(() => ({}));
        testResult = `FAILED (${testRes.status})`;
        testError = errData.error?.message || 'Unknown error';
      }
    }

    return res.status(200).json({
      keyFound: true,
      keyPrefix: geminiKey.substring(0, 8) + '...',
      availableModels: models,
      bestModel: testModel || 'none found',
      testCallResult: testResult,
      testCallError: testError
    });

  } catch (err) {
    return res.status(200).json({
      keyFound: true,
      error: err.message
    });
  }
}
