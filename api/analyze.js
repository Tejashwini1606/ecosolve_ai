export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  try {
    const { problemDescription, image, imageMimeType, provider = 'gemini', selectedGeminiModel = 'gemini-1.5-flash' } = req.body;

    const systemPrompt = `You are EcoSolve AI, a premium environmental data analyzer. Your job is to analyze the environmental problem, pollutant, or waste type provided by the user (either via text, an image, or both) and return a detailed, structured analysis in JSON format.

If the user provides an image, but it does not contain or depict any identifiable environmental problem, pollutant, waste type, or ecological hazard (or if the image is blank, blurry, or irrelevant), you must return a JSON object with the following schema:
{
  "unidentified": true,
  "message": "I am unable to identify the problem, please type what the problem is"
}

Otherwise, your output must be a single, valid JSON object containing the following keys (do not wrap in markdown, do not add introductory/concluding text, just return the JSON object):
{
  "problemName": "The name of the environmental problem, pollutant, or waste type analyzed (e.g. 'Microplastics in the Ocean')",
  "overview": "A clear, engaging, and high-impact description of the problem, its scale, and why it is critical (2-3 sentences).",
  "severity": {
    "level": "One of: Low, Medium, High, Critical",
    "score": 9.2, // A number between 0.0 and 10.0 indicating urgency
    "description": "Brief explanation of the score and immediate threat level."
  },
  "pollutantsAndSources": [
    {
      "name": "Pollutant or substance name",
      "source": "Where it comes from or how it enters the environment"
    }
  ],
  "impacts": {
    "ecological": "Specific impacts on ecosystems, wildlife, and biodiversity.",
    "humanHealth": "Risks to human health, food safety, water security, or air quality.",
    "economic": "Estimated economic damage, industry impacts, and societal costs."
  },
  "solutions": [
    {
      "name": "Name of the solution",
      "description": "How the solution works, what technology or policy is involved.",
      "effectiveness": 85, // An integer percentage between 0 and 100
      "feasibility": "High, Medium, or Low"
    }
  ],
  "timeline": "Timeline/outlook under different action scenarios (e.g. business-as-usual vs active intervention).",
  "recommendations": [
    "High-priority action item 1 for individuals or local authorities.",
    "High-priority action item 2...",
    "High-priority action item 3..."
  ]
}

Only return the raw JSON object. Do not include any introductory or concluding text. Do not wrap the JSON in markdown code blocks.`;

    if (provider === 'gemini') {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return res.status(500).json({ error: { message: 'Shared Gemini API Key is not configured on the server.' } });
      }

      const isGeminiModel = selectedGeminiModel.toLowerCase().includes('gemini');
      const parts = [];

      if (image && imageMimeType) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: image
          }
        });
      }

      const textPrompt = image
        ? `Analyze the environmental problem shown in this image. Additional context/description provided by the user: "${problemDescription || 'Identify the problem from this image.'}"`
        : `Analyze the following environmental problem: "${problemDescription}"`;

      parts.push({
        text: isGeminiModel ? textPrompt : `${systemPrompt}\n\n${textPrompt}`
      });

      const requestBody = {
        contents: [{ parts }]
      };

      if (isGeminiModel) {
        requestBody.systemInstruction = {
          parts: [{ text: systemPrompt }]
        };
        requestBody.generationConfig = {
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
          temperature: 0.2
        };
      } else {
        requestBody.generationConfig = {
          maxOutputTokens: 4096,
          temperature: 0.2
        };
      }

      // Auto-try models from newest to oldest — shared key may not have access to all models
      const MODEL_FALLBACK_LIST = [
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b'
      ];

      let response;
      let lastError = null;

      for (const modelToTry of MODEL_FALLBACK_LIST) {
        try {
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (response.ok) break; // Found a working model, stop trying

          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error?.message || `Gemini API returned status ${response.status}`;

          // If model not found / not supported, try the next one
          const isModelError = response.status === 404 ||
                               errMsg.toLowerCase().includes('not found') ||
                               errMsg.toLowerCase().includes('not supported') ||
                               errMsg.toLowerCase().includes('does not exist');

          if (isModelError) {
            lastError = errMsg;
            response = null;
            continue; // try next model
          }

          // For other errors (rate limit, overload), wait and retry same model
          const isTransientError = response.status === 429 || response.status === 503 || response.status === 500 ||
                                   errMsg.toLowerCase().includes("high demand") ||
                                   errMsg.toLowerCase().includes("overloaded") ||
                                   errMsg.toLowerCase().includes("temporary");

          if (isTransientError) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            // Try the next model instead of retrying same
            lastError = errMsg;
            response = null;
            continue;
          }

          throw new Error(errMsg); // Non-recoverable error
        } catch (fetchErr) {
          lastError = fetchErr.message;
          response = null;
          // Continue to next model
        }
      }

      if (!response || !response.ok) {
        throw new Error(lastError || 'All Gemini models failed. Please try again later.');
      }

      const data = await response.json();
      return res.status(200).json(data);

    } else {
      // Claude Provider
      const claudeKey = process.env.CLAUDE_API_KEY;
      if (!claudeKey) {
        return res.status(500).json({ error: { message: 'Shared Claude API Key is not configured on the server.' } });
      }

      const messagesContent = [];
      if (image && imageMimeType) {
        messagesContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: imageMimeType,
            data: image
          }
        });
      }

      messagesContent.push({
        type: "text",
        text: image
          ? `Analyze the environmental problem shown in this image. Additional description: "${problemDescription || 'Please analyze this photo.'}"`
          : `Analyze the following environmental problem: "${problemDescription}"`
      });

      let response;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': claudeKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              temperature: 0.2,
              system: systemPrompt,
              messages: [{ role: 'user', content: messagesContent }]
            })
          });

          if (response.ok) break;

          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error?.message || `Claude API returned status ${response.status}`;
          const isTransientError = response.status === 429 || response.status === 529 || response.status === 500 ||
                                   errMsg.toLowerCase().includes("overloaded") ||
                                   errMsg.toLowerCase().includes("limit") ||
                                   errMsg.toLowerCase().includes("temporary");

          if (isTransientError && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
          } else {
            throw new Error(errMsg);
          }
        } catch (fetchErr) {
          if (attempts >= maxAttempts) throw fetchErr;
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: error.message || 'Internal Server Error' } });
  }
}
