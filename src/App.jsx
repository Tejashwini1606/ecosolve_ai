import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  ArrowRight, 
  CheckCircle, 
  Clipboard, 
  ClipboardCheck, 
  Compass, 
  HelpCircle, 
  Settings, 
  Layers, 
  RefreshCw, 
  Sparkles, 
  Activity, 
  Globe, 
  Landmark, 
  HeartPulse, 
  Eye, 
  EyeOff,
  Camera,
  Upload,
  X
} from 'lucide-react';

// Example chips for environmental problems
const EXAMPLE_CHIPS = [
  "Microplastics in ocean",
  "Chemical waste in soil",
  "Industrial effluents in river",
  "Plastic pollution in drinking water",
  "Heavy metals in groundwater"
];

// Helper function to repair truncated JSON strings character-by-character
function repairTruncatedJson(str) {
  str = str.trim();
  try {
    JSON.parse(str);
    return str; // Already valid JSON
  } catch (e) {
    // Continue to repair logic
  }

  let repaired = "";
  let stack = [];
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (inString) {
      if (escaped) {
        escaped = false;
        repaired += char;
      } else if (char === '\\') {
        escaped = true;
        repaired += char;
      } else if (char === '"') {
        inString = false;
        repaired += char;
      } else {
        repaired += char;
      }
    } else {
      if (char === '"') {
        inString = true;
        repaired += char;
      } else if (char === '{') {
        stack.push('}');
        repaired += char;
      } else if (char === '[') {
        stack.push(']');
        repaired += char;
      } else if (char === '}') {
        if (stack[stack.length - 1] === '}') {
          stack.pop();
        }
        repaired += char;
      } else if (char === ']') {
        if (stack[stack.length - 1] === ']') {
          stack.pop();
        }
        repaired += char;
      } else {
        repaired += char;
      }
    }
  }
  
  if (inString) {
    repaired += '"';
  }
  
  // Backtrack character-by-character to find the last valid state that closes successfully
  let attempt = repaired;
  while (attempt.length > 0) {
    try {
      let temp = attempt;
      for (let j = stack.length - 1; j >= 0; j--) {
        temp += stack[j];
      }
      JSON.parse(temp);
      return temp; // Success!
    } catch (err) {
      attempt = attempt.slice(0, -1);
      
      // Recalculate stack, string context for new shortened string
      stack = [];
      inString = false;
      escaped = false;
      for (let k = 0; k < attempt.length; k++) {
        const c = attempt[k];
        if (inString) {
          if (escaped) escaped = false;
          else if (c === '\\') escaped = true;
          else if (c === '"') inString = false;
        } else {
          if (c === '"') inString = true;
          else if (c === '{') stack.push('}');
          else if (c === '[') stack.push(']');
          else if (c === '}') { if (stack[stack.length - 1] === '}') stack.pop(); }
          else if (c === ']') { if (stack[stack.length - 1] === ']') stack.pop(); }
        }
      }
      if (inString) {
        attempt += '"';
        inString = false;
      }
    }
  }
  
  return str;
}

function App() {
  const [userInput, setUserInput] = useState('');
  
  // API settings
  const [provider, setProvider] = useState('gemini'); // 'gemini' or 'claude'
  const [geminiKey, setGeminiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  
  // Gemini model selection
  const [geminiModels, setGeminiModels] = useState(['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-8b']);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('gemini-1.5-flash');

  // Image Upload Settings
  const [selectedImage, setSelectedImage] = useState(null); // { file, previewUrl, base64Data, mimeType }

  // UI state
  const [activeTab, setActiveTab] = useState('assessment'); // 'assessment', 'pollutants', 'solutions', 'action'
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [hideApiKey, setHideApiKey] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [animateProgress, setAnimateProgress] = useState(false);
  const [showUnidentifiedModal, setShowUnidentifiedModal] = useState(false);

  // Load API Keys from localStorage on mount
  useEffect(() => {
    const savedGeminiKey = localStorage.getItem('ecosolve_gemini_key');
    const savedClaudeKey = localStorage.getItem('ecosolve_api_key');
    
    if (savedGeminiKey) {
      setGeminiKey(savedGeminiKey);
      loadGeminiModels(savedGeminiKey);
    }
    if (savedClaudeKey) {
      setClaudeKey(savedClaudeKey);
    }

    // Prompt key entry if default provider key is missing
    if (!savedGeminiKey) {
      setShowKeyInput(true);
    }
  }, []);

  // Fetch available Gemini models for the provided key
  const loadGeminiModels = async (key) => {
    if (!key) return;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
      if (response.ok) {
        const data = await response.json();
        const list = (data.models || [])
          .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
          .map(m => m.name.replace('models/', ''));
        
        if (list.length > 0) {
          setGeminiModels(list);
          // Auto-select best available model
          if (list.includes('gemini-1.5-flash')) {
            setSelectedGeminiModel('gemini-1.5-flash');
          } else if (list.includes('gemini-1.5-flash-8b')) {
            setSelectedGeminiModel('gemini-1.5-flash-8b');
          } else if (list.includes('gemini-2.5-flash')) {
            setSelectedGeminiModel('gemini-2.5-flash');
          } else {
            setSelectedGeminiModel(list[0]);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching Gemini models list:", e);
    }
  };

  // Animate progress bars when analysisResult is loaded
  useEffect(() => {
    if (analysisResult) {
      const timer = setTimeout(() => {
        setAnimateProgress(true);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setAnimateProgress(false);
    }
  }, [analysisResult]);

  // Handle Save API Key
  const handleSaveKey = (keyVal) => {
    const trimmed = keyVal.trim();
    if (provider === 'gemini') {
      setGeminiKey(trimmed);
      localStorage.setItem('ecosolve_gemini_key', trimmed);
      loadGeminiModels(trimmed);
    } else {
      setClaudeKey(trimmed);
      localStorage.setItem('ecosolve_api_key', trimmed);
    }
    setShowKeyInput(false);
  };

  // Pre-fill input from chip click
  const handleChipClick = (text) => {
    setUserInput(text);
  };

  // Handle image selection via file upload
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      // Extract raw base64 data (strip data:*/*;base64, prefix)
      const base64Data = reader.result.split(',')[1];
      const mimeType = file.type;

      setSelectedImage({
        file,
        previewUrl: reader.result,
        base64Data,
        mimeType
      });
    };
    reader.readAsDataURL(file);
  };

  // Remove uploaded image
  const handleRemoveImage = () => {
    setSelectedImage(null);
    const fileInput = document.getElementById('image-upload-input');
    if (fileInput) fileInput.value = '';
  };

  // Call the selected API
  const runAnalysis = async (problemDescription) => {
    const activeKey = provider === 'gemini' ? geminiKey : claudeKey;
    
    if (!activeKey) {
      setError(`A valid ${provider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'} API Key is required to run the analysis.`);
      setShowKeyInput(true);
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisResult(null);
    setActiveTab('assessment'); // Reset back to first tab for new results

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

    try {
      let rawText = '';

      if (provider === 'gemini') {
        const isGeminiModel = selectedGeminiModel.toLowerCase().includes('gemini');
        
        // Gemma models are text-only; they do not support image processing.
        if (selectedImage && !isGeminiModel) {
          throw new Error("Gemma open models do not support image analysis. Please open the settings (gear icon) and switch to a Gemini model (like gemini-1.5-flash) to analyze pictures.");
        }

        // Construct Gemini request body
        const parts = [];

        // Add image if selected
        if (selectedImage) {
          parts.push({
            inlineData: {
              mimeType: selectedImage.mimeType,
              data: selectedImage.base64Data
            }
          });
        }

        // Add text prompt
        const textPrompt = selectedImage
          ? `Analyze the environmental problem shown in this image. Additional context/description provided by the user: "${problemDescription || 'Identify the problem from this image.'}"`
          : `Analyze the following environmental problem: "${problemDescription}"`;

        parts.push({
          text: isGeminiModel
            ? textPrompt
            : `${systemPrompt}\n\n${textPrompt}`
        });

        const requestBody = {
          contents: [
            { parts }
          ]
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
          // Speed optimizations for Gemma models
          requestBody.generationConfig = {
            maxOutputTokens: 4096,
            temperature: 0.2
          };
        }

        // Direct fetch to Gemini API with robust retries and auto-fallback
        let activeModel = selectedGeminiModel;
        let response;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          attempts++;
          try {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${geminiKey}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            });
            
            if (response.ok) {
              break;
            }
            
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Gemini API returned status ${response.status}`;
            const isTransientError = response.status === 429 || response.status === 503 || response.status === 500 || 
                                     errMsg.toLowerCase().includes("high demand") || 
                                     errMsg.toLowerCase().includes("limit") || 
                                     errMsg.toLowerCase().includes("overloaded") || 
                                     errMsg.toLowerCase().includes("temporary");
            
            if (isTransientError && attempts < maxAttempts) {
              console.warn(`Transient error on model ${activeModel} (attempt ${attempts}): ${errMsg}. Retrying...`);
              
              // If it's a 2.5 model and experiencing high demand, automatically switch to stable 1.5-flash
              if (activeModel.includes('2.5') && activeModel !== 'gemini-1.5-flash') {
                console.warn(`Auto-fallback: switching from ${activeModel} to gemini-1.5-flash due to overload.`);
                activeModel = 'gemini-1.5-flash';
                setSelectedGeminiModel('gemini-1.5-flash');
              }
              
              await new Promise(resolve => setTimeout(resolve, 1500));
              continue;
            } else {
              throw new Error(errMsg);
            }
          } catch (fetchErr) {
            if (attempts >= maxAttempts) {
              throw fetchErr;
            }
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }

        const data = await response.json();
        rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
      } else {
        // Claude API request configuration
        let messagesContent = [];

        // Inject image if present
        if (selectedImage) {
          messagesContent.push({
            type: "image",
            source: {
              type: "base64",
              media_type: selectedImage.mimeType,
              data: selectedImage.base64Data
            }
          });
        }

        messagesContent.push({
          type: "text",
          text: selectedImage
            ? `Analyze the environmental problem shown in this image. Additional description: "${problemDescription || 'Please analyze this photo.'}"`
            : `Analyze the following environmental problem: "${problemDescription}"`
        });

        let response;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          attempts++;
          try {
            response = await fetch('/api/claude', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': claudeKey,
                'anthropic-version': '2023-06-01',
                'dangerously-allow-html-user-access': 'true'
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                temperature: 0.2,
                system: systemPrompt,
                messages: [
                  {
                    role: 'user',
                    content: messagesContent
                  }
                ]
              })
            });
            
            if (response.ok) {
              break;
            }
            
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Claude API returned status ${response.status}`;
            const isTransientError = response.status === 429 || response.status === 529 || response.status === 500 || 
                                     errMsg.toLowerCase().includes("overloaded") || 
                                     errMsg.toLowerCase().includes("limit") || 
                                     errMsg.toLowerCase().includes("temporary");
            
            if (isTransientError && attempts < maxAttempts) {
              console.warn(`Transient error on Claude (attempt ${attempts}): ${errMsg}. Retrying...`);
              await new Promise(resolve => setTimeout(resolve, 1500));
              continue;
            } else {
              throw new Error(errMsg);
            }
          } catch (fetchErr) {
            if (attempts >= maxAttempts) {
              throw fetchErr;
            }
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }

        const data = await response.json();
        rawText = data.content?.[0]?.text;
      }

      if (!rawText) {
        throw new Error(`Empty response received from the ${provider === 'gemini' ? 'Gemini' : 'Claude'} model.`);
      }

      // Extract the first matching JSON object by counting curly braces (Gemma may output conversational wraps or trailing braces)
      let cleanJsonText = rawText.trim();
      const firstCurly = cleanJsonText.indexOf('{');
      if (firstCurly !== -1) {
        let braceCount = 0;
        let matchedIndex = -1;
        for (let i = firstCurly; i < cleanJsonText.length; i++) {
          if (cleanJsonText[i] === '{') {
            braceCount++;
          } else if (cleanJsonText[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              matchedIndex = i;
              break;
            }
          }
        }
        if (matchedIndex !== -1) {
          cleanJsonText = cleanJsonText.substring(firstCurly, matchedIndex + 1);
        } else {
          // It was truncated! Extract from firstCurly to the end of the string, and repair it
          cleanJsonText = cleanJsonText.substring(firstCurly);
          cleanJsonText = repairTruncatedJson(cleanJsonText);
        }
      }

      const parsedData = JSON.parse(cleanJsonText);
      if (parsedData.unidentified) {
        setShowUnidentifiedModal(true);
        setLoading(false);
        return;
      }
      setAnalysisResult(parsedData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to connect to the AI API. Make sure your API key is correct and valid.");
    } finally {
      setLoading(false);
    }
  };

  // Form submission handler
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim() && !selectedImage) return;
    runAnalysis(userInput);
  };

  // Reset analysis view to start fresh
  const handleReset = () => {
    setAnalysisResult(null);
    setUserInput('');
    setError(null);
    setSelectedImage(null);
    setActiveTab('assessment');
  };

  // Copy structured analysis report in Markdown
  const handleCopyMarkdown = () => {
    if (!analysisResult) return;
    
    const markdown = `# EcoSolve AI Analysis: ${analysisResult.problemName}

## Overview
${analysisResult.overview}

## Severity Level: ${analysisResult.severity?.level} (${analysisResult.severity?.score}/10)
${analysisResult.severity?.description}

## Key Pollutants & Sources
${analysisResult.pollutantsAndSources?.map(p => `- **${p.name}**: ${p.source}`).join('\n')}

## Environmental Impacts
* **Ecological**: ${analysisResult.impacts?.ecological}
* **Human Health**: ${analysisResult.impacts?.humanHealth}
* **Economic**: ${analysisResult.impacts?.economic}

## Viable Solutions
${analysisResult.solutions?.map(s => `### ${s.name} (Effectiveness: ${s.effectiveness}%, Feasibility: ${s.feasibility})
${s.description}`).join('\n\n')}

## Recovery Timeline
${analysisResult.timeline}

## Recommended Actions
${analysisResult.recommendations?.map(r => `- ${r}`).join('\n')}

---
*Analysis generated dynamically by EcoSolve AI utilizing ${provider === 'gemini' ? `Google Gemini (${selectedGeminiModel})` : 'Claude Sonnet 4'}.*`;

    navigator.clipboard.writeText(markdown)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  // Severity style helper
  const getSeverityBadgeClass = (level) => {
    const l = level?.toLowerCase();
    if (l === 'critical') return 'badge-critical';
    if (l === 'high') return 'badge-high';
    if (l === 'medium') return 'badge-medium';
    return 'badge-low';
  };

  const getSeverityColor = (level) => {
    const l = level?.toLowerCase();
    if (l === 'critical') return '#ff3860';
    if (l === 'high') return '#ff9966';
    if (l === 'medium') return '#00e5cc';
    return '#aaff00';
  };

  // Active key selector based on current provider
  const getActiveKeyVal = () => {
    return provider === 'gemini' ? geminiKey : claudeKey;
  };

  // Tab change handler triggering progress re-animation
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setAnimateProgress(false);
    setTimeout(() => {
      setAnimateProgress(true);
    }, 150);
  };

  return (
    <>
      {/* Bioluminescent Gradient Mesh Background */}
      <div className="bg-mesh">
        <div className="mesh-blob blob-1"></div>
        <div className="mesh-blob blob-2"></div>
        <div className="mesh-blob blob-3"></div>
      </div>

      {/* Unidentified Image Warning Popup */}
      {showUnidentifiedModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(8, 10, 15, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel animate-card" style={{
            width: '100%',
            maxWidth: '420px',
            padding: '28px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 170, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px',
            '--delay': 0,
            boxShadow: '0 0 30px rgba(255, 170, 0, 0.15)'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(255, 170, 0, 0.1)',
              border: '1px solid rgba(255, 170, 0, 0.3)',
              color: '#ffaa00',
              marginBottom: '4px'
            }}>
              <HelpCircle size={28} />
            </div>
            
            <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', color: '#ffaa00' }}>
              Unable to Identify Problem
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
              I am unable to identify the problem. Please describe the problem through text.
            </p>
            
            <button 
              onClick={() => setShowUnidentifiedModal(false)} 
              className="btn-primary"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #ffaa00 0%, #ff7700 100%)',
                boxShadow: '0 4px 20px rgba(255, 170, 0, 0.2)',
                color: '#fff',
                marginTop: '8px'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header Section */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={handleReset} className="cursor-pointer">
            <span style={{ fontSize: '1.8rem', color: 'var(--accent-teal)', fontFamily: 'var(--font-heading)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⬡ ECOSOLVE AI
            </span>
          </div>

          {/* Hidden Settings Cog Icon */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowKeyInput(!showKeyInput)}
              className={`btn-settings ${!getActiveKeyVal() ? 'warning' : ''}`}
              title={getActiveKeyVal() ? `${provider === 'gemini' ? 'Gemini' : 'Claude'} Connected — Click to Configure API` : 'Set API Key'}
            >
              <Settings size={20} className={getActiveKeyVal() ? "text-teal" : "text-muted"} />
            </button>

            {showKeyInput && (
              <div className="glass-panel" style={{ position: 'absolute', right: 0, top: '48px', width: '320px', padding: '20px', zIndex: 100, border: '1px solid rgba(0, 229, 204, 0.3)' }}>
                <h4 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                  <Settings size={14} className="text-teal" /> AI Provider Configuration
                </h4>
                
                {/* Provider Selector */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Select Provider
                  </label>
                  <select 
                    value={provider} 
                    onChange={(e) => setProvider(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="gemini">Google Gemini (Free Tier)</option>
                    <option value="claude">Anthropic Claude</option>
                  </select>
                </div>

                {/* Gemini Model Selector */}
                {provider === 'gemini' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Select Gemini Model
                    </label>
                    <select 
                      value={selectedGeminiModel} 
                      onChange={(e) => setSelectedGeminiModel(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {geminiModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  {provider === 'gemini' 
                    ? 'Requests connect directly to Google APIs. Free tier keys require no credit balance.'
                    : 'Requests are proxied locally to prevent CORS blockages. Needs Anthropic key.'
                  }
                </p>

                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', position: 'relative' }}>
                  <input 
                    type={hideApiKey ? 'password' : 'text'}
                    placeholder={provider === 'gemini' ? 'AIzaSy...' : 'sk-ant-api03-...'} 
                    key={provider} // Reset when provider changes
                    defaultValue={getActiveKeyVal()}
                    id="api-key-input"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      paddingRight: '36px',
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                  <button 
                    onClick={() => setHideApiKey(!hideApiKey)} 
                    style={{ 
                      position: 'absolute', 
                      right: '8px', 
                      top: '50%', 
                      transform: 'translateY(-50%)', 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--text-muted)', 
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    title={hideApiKey ? "Show Key" : "Hide Key"}
                  >
                    {hideApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button 
                    className="btn-secondary" 
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    onClick={() => setShowKeyInput(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn-primary" 
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    onClick={() => {
                      const val = document.getElementById('api-key-input').value;
                      handleSaveKey(val);
                    }}
                  >
                    Save Key
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          {/* Default Search State */}
          {!analysisResult && !loading && !error && (
            <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%', textAlign: 'center', padding: '40px 0', '--delay': 0 }} className="animate-card">
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(0, 229, 204, 0.08)', border: '1px solid rgba(0, 229, 204, 0.2)', color: 'var(--accent-teal)', marginBottom: '24px', boxShadow: '0 0 20px rgba(0, 229, 204, 0.1)' }}>
                <Sparkles size={28} />
              </div>
              <h1 style={{ fontSize: '2.5rem', marginBottom: '12px', lineHeight: 1.2 }}>
                Analyze Environmental Solutions Instantly
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '32px', maxWidth: '520px', margin: '0 auto 32px' }}>
                Type a problem, capture a live photo, or upload an image file for immediate analysis.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="search-container" style={{ marginBottom: '20px', position: 'relative' }}>
                  <textarea 
                    className="search-textarea"
                    placeholder="Describe an environmental problem, or upload a photo to analyze..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    style={{ paddingRight: '60px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                  
                  {/* Photo uploading button */}
                  <div style={{ position: 'absolute', right: '14px', bottom: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Upload button */}
                    <button
                      type="button"
                      onClick={() => document.getElementById('image-upload-input').click()}
                      style={{
                        background: selectedImage ? 'rgba(0, 229, 204, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                        border: selectedImage ? '1px solid var(--accent-teal)' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        width: '38px',
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: selectedImage ? 'var(--accent-teal)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      title="Upload Image File"
                    >
                      <Upload size={18} />
                    </button>
                    
                    <input 
                      type="file"
                      id="image-upload-input"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageChange}
                    />
                  </div>
                </div>

                {/* Selected Image Preview */}
                {selectedImage && (
                  <div style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '8px 12px', 
                    borderRadius: '12px', 
                    background: 'rgba(0, 229, 204, 0.05)', 
                    border: '1px solid rgba(0, 229, 204, 0.2)',
                    marginBottom: '20px',
                    textAlign: 'left'
                  }}>
                    <img 
                      src={selectedImage.previewUrl} 
                      alt="Preview" 
                      style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Photo Selected</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {(selectedImage.file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleRemoveImage}
                      style={{
                        background: 'rgba(255, 56, 96, 0.1)',
                        border: '1px solid rgba(255, 56, 96, 0.2)',
                        color: '#ff3860',
                        borderRadius: '6px',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Remove Image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                
                {/* Example Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '32px' }}>
                  {EXAMPLE_CHIPS.map((chip, idx) => (
                    <button 
                      key={idx}
                      type="button"
                      className={`chip ${userInput === chip ? 'active' : ''}`}
                      onClick={() => handleChipClick(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={!userInput.trim() && !selectedImage}
                  style={{ width: '100%', maxWidth: '240px', padding: '16px 32px' }}
                >
                  Analyze Problem <ArrowRight size={18} />
                </button>
              </form>
            </div>
          )}

          {/* Loading Skeletons */}
          {loading && (
            <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
              {/* Pulsing Status Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '32px' }}>
                <RefreshCw size={20} className="text-teal" style={{ animation: 'spin 2s linear infinite' }} />
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: 'var(--accent-teal)', letterSpacing: '0.05em' }}>
                  ECOSOLVE ENGINE COG-ANALYZING DATA...
                </span>
              </div>

              {/* Grid of Shimmering Cards */}
              <div className="cards-grid">
                {/* Large Card: Overview Shimmer */}
                <div className="glass-panel skeleton-box" style={{ gridColumn: 'span 2', minHeight: '220px', padding: '24px' }}>
                  <div style={{ height: '28px', width: '40%', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', marginBottom: '16px' }}></div>
                  <div style={{ height: '16px', width: '90%', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '4px', marginBottom: '10px' }}></div>
                  <div style={{ height: '16px', width: '80%', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '4px', marginBottom: '20px' }}></div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ height: '32px', width: '120px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '100px' }}></div>
                    <div style={{ height: '12px', flex: 1, background: 'rgba(255, 255, 255, 0.03)', borderRadius: '99px' }}></div>
                  </div>
                </div>

                {/* Left Card Shimmer */}
                <div className="glass-panel skeleton-box" style={{ minHeight: '260px', padding: '24px' }}>
                  <div style={{ height: '24px', width: '50%', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', marginBottom: '20px' }}></div>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ marginBottom: '16px' }}>
                      <div style={{ height: '16px', width: '30%', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', marginBottom: '6px' }}></div>
                      <div style={{ height: '14px', width: '75%', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '4px' }}></div>
                    </div>
                  ))}
                </div>

                {/* Right Card Shimmer */}
                <div className="glass-panel skeleton-box" style={{ minHeight: '260px', padding: '24px' }}>
                  <div style={{ height: '24px', width: '50%', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', marginBottom: '20px' }}></div>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ marginBottom: '16px' }}>
                      <div style={{ height: '16px', width: '25%', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', marginBottom: '6px' }}></div>
                      <div style={{ height: '14px', width: '80%', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '4px' }}></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%', textAlign: 'center', '--delay': 0 }} className="animate-card">
              <div className="glass-panel" style={{ padding: '40px', border: '1px solid rgba(255, 56, 96, 0.3)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(255, 56, 96, 0.1)', border: '1px solid rgba(255, 56, 96, 0.2)', color: '#ff3860', marginBottom: '20px' }}>
                  <ShieldAlert size={26} />
                </div>
                <h3 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>Analysis Encountered an Error</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: 1.5 }}>
                  {error}
                </p>

                {provider === 'gemini' && (
                  <div style={{ margin: '20px auto', padding: '16px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'left', maxWidth: '480px' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-teal)', marginBottom: '6px', fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                      Troubleshoot Model Access
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.4 }}>
                      Some regions or keys do not have access to the default model. Select an alternative active model on your key:
                    </p>
                    <select 
                      value={selectedGeminiModel} 
                      onChange={(e) => setSelectedGeminiModel(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {geminiModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button onClick={handleReset} className="btn-secondary">
                    Back to Search
                  </button>
                  <button onClick={() => runAnalysis(userInput)} className="btn-primary" style={{ background: 'linear-gradient(135deg, #ff3860 0%, #ff5500 100%)', boxShadow: '0 4px 20px rgba(255, 56, 96, 0.2)' }}>
                    <RefreshCw size={14} /> Retry Analysis
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Output Analysis Results */}
          {analysisResult && (
            <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', paddingBottom: '60px' }}>
              
              {/* Results Control Hub (Top sticky action bar) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px', '--delay': 0 }} className="animate-card">
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--accent-teal)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                    Analysis Assessment ({provider === 'gemini' ? 'Gemini' : 'Claude'})
                  </span>
                  <h2 style={{ fontSize: '1.8rem', lineHeight: 1.2 }}>{analysisResult.problemName}</h2>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={handleCopyMarkdown} className="btn-secondary">
                    {copied ? <ClipboardCheck size={16} className="text-teal" /> : <Clipboard size={16} />}
                    <span>{copied ? 'Copied Report!' : 'Copy Full Analysis'}</span>
                  </button>
                  <button onClick={handleReset} className="btn-primary">
                    Analyze Another Problem
                  </button>
                </div>
              </div>

              {/* Tab Selector Switcher */}
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
                paddingBottom: '12px', 
                marginBottom: '28px', 
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                '--delay': 0.1
              }} className="animate-card">
                <button 
                  onClick={() => handleTabChange('assessment')}
                  className={`tab-btn ${activeTab === 'assessment' ? 'active' : ''}`}
                >
                  <Activity size={16} /> Assessment
                </button>
                <button 
                  onClick={() => handleTabChange('pollutants')}
                  className={`tab-btn ${activeTab === 'pollutants' ? 'active' : ''}`}
                >
                  <Layers size={16} /> Pollutants & Impacts
                </button>
                <button 
                  onClick={() => handleTabChange('solutions')}
                  className={`tab-btn ${activeTab === 'solutions' ? 'active' : ''}`}
                >
                  <Sparkles size={16} /> Solutions
                </button>
                <button 
                  onClick={() => handleTabChange('action')}
                  className={`tab-btn ${activeTab === 'action' ? 'active' : ''}`}
                >
                  <CheckCircle size={16} /> Action Plan
                </button>
              </div>

              {/* Cards Grid */}
              <div className="cards-grid">
                
                {/* TAB 1: ASSESSMENT */}
                {activeTab === 'assessment' && (
                  <section className="glass-panel animate-card" style={{ gridColumn: 'span 2', padding: '28px', '--delay': 1 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Activity size={18} className="text-teal" /> Problem Assessment
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className={`badge ${getSeverityBadgeClass(analysisResult.severity?.level)}`}>
                          {analysisResult.severity?.level || 'Assessment Needed'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', color: getSeverityColor(analysisResult.severity?.level) }}>
                          {analysisResult.severity?.score}/10
                        </span>
                      </div>
                    </div>

                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '24px' }}>
                      {analysisResult.overview}
                    </p>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <span>SEVERITY THREAT SCORE</span>
                        <span>{analysisResult.severity?.description}</span>
                      </div>
                      <div className="progress-container" style={{ height: '10px' }}>
                        <div 
                          className="progress-bar" 
                          style={{ 
                            width: animateProgress ? `${(analysisResult.severity?.score || 0) * 10}%` : '0%',
                            background: `linear-gradient(to right, var(--accent-teal) 0%, ${getSeverityColor(analysisResult.severity?.level)} 100%)`,
                            boxShadow: `0 0 10px ${getSeverityColor(analysisResult.severity?.level)}40`
                          }}
                        />
                      </div>
                    </div>
                  </section>
                )}

                {/* TAB 2: POLLUTANTS & IMPACTS */}
                {activeTab === 'pollutants' && (
                  <>
                    <section className="glass-panel animate-card" style={{ padding: '28px', '--delay': 1 }}>
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Layers size={18} className="text-teal" /> Primary Pollutants & Sources
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {analysisResult.pollutantsAndSources?.map((item, idx) => (
                          <div key={idx} style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', borderLeft: '3px solid var(--accent-teal)' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                              {item.name}
                            </h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Source: </span>{item.source}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="glass-panel animate-card" style={{ padding: '28px', '--delay': 2 }}>
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Globe size={18} className="text-teal" /> Environmental Impacts
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '14px' }}>
                          <div style={{ color: 'var(--accent-teal)', flexShrink: 0, marginTop: '2px' }}>
                            <Globe size={18} />
                          </div>
                          <div>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '2px' }}>Ecological</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{analysisResult.impacts?.ecological}</p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '14px' }}>
                          <div style={{ color: '#ff7043', flexShrink: 0, marginTop: '2px' }}>
                            <HeartPulse size={18} />
                          </div>
                          <div>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '2px' }}>Human Health</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{analysisResult.impacts?.humanHealth}</p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '14px' }}>
                          <div style={{ color: 'var(--accent-lime)', flexShrink: 0, marginTop: '2px' }}>
                            <Landmark size={18} />
                          </div>
                          <div>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '2px' }}>Economic Damage</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{analysisResult.impacts?.economic}</p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </>
                )}

                {/* TAB 3: SOLUTIONS */}
                {activeTab === 'solutions' && (
                  <section className="glass-panel animate-card" style={{ gridColumn: 'span 2', padding: '28px', '--delay': 1 }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Sparkles size={18} className="text-teal" /> Viable Solutions & Feasibility
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {analysisResult.solutions?.map((sol, idx) => (
                        <div key={idx} style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', justify_content: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }} className="text-teal">{sol.name}</h4>
                            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)' }}>
                              Feasibility: <strong style={{ color: 'var(--text-primary)' }}>{sol.feasibility}</strong>
                            </span>
                          </div>
                          
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            {sol.description}
                          </p>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                              <span>SOLUTION EFFECTIVENESS</span>
                              <span style={{ color: 'var(--accent-lime)' }}>{sol.effectiveness}%</span>
                            </div>
                            <div className="progress-container">
                              <div 
                                className="progress-bar"
                                style={{ 
                                  width: animateProgress ? `${sol.effectiveness}%` : '0%',
                                  background: 'linear-gradient(to right, var(--accent-teal) 0%, var(--accent-lime) 100%)',
                                  boxShadow: '0 0 10px rgba(170, 255, 0, 0.15)'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* TAB 4: ACTION PLAN */}
                {activeTab === 'action' && (
                  <>
                    <section className="glass-panel animate-card" style={{ padding: '28px', '--delay': 1 }}>
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Compass size={18} className="text-teal" /> Recovery Timeline Outlook
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                        {analysisResult.timeline}
                      </p>
                    </section>

                    <section className="glass-panel animate-card" style={{ padding: '28px', '--delay': 2 }}>
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CheckCircle size={18} className="text-teal" /> Key Actionable Recommendations
                      </h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {analysisResult.recommendations?.map((rec, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ color: 'var(--accent-lime)', flexShrink: 0, marginTop: '2px' }}>
                              <CheckCircle size={16} />
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {rec}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}

              </div>
            </div>
          )}

        </main>
        
        {/* Footer */}
        <footer style={{ marginTop: '40px', padding: '24px 0 12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <p>© {new Date().getFullYear()} EcoSolve AI. Built using Google Gemini & Anthropic Claude. Empowering local communities with direct AI environmental insights.</p>
        </footer>

      </div>
    </>
  );
}

export default App;
