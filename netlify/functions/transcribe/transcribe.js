/**
 * Netlify Function: Claude Vision API Proxy
 *
 * This function acts as a server-side proxy to avoid CORS issues
 * when calling the Claude API from the browser.
 */

exports.handler = async (event, context) => {
  // Set longer timeout (26 seconds is max on free tier)
  context.callbackWaitsForEmptyEventLoop = false;

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Parse request body
    const { apiKey, image, prompt } = JSON.parse(event.body);

    // Validate required fields
    if (!apiKey || !image || !prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: apiKey, image, or prompt'
        })
      };
    }

    console.log('Calling Claude API with image size:', image.length, 'bytes');
    console.log('Prompt length:', prompt.length, 'characters');

    // Detect actual image format from base64 header
    // PNG starts with: iVBORw0KGgo
    // JPEG starts with: /9j/
    const isPNG = image.startsWith('iVBORw0KGgo');
    const isJPEG = image.startsWith('/9j/');
    const media_type = isPNG ? 'image/png' : (isJPEG ? 'image/jpeg' : 'image/png');

    console.log('Detected image format:', media_type);

    // Call Claude API with timeout handling
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout (max 26s on free tier)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: media_type,
                  data: image
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }]
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      // Parse Claude API response
      const data = await response.json();

      // Check for errors from Claude API
      if (!response.ok) {
        console.error('Claude API error:', data);
        return {
          statusCode: response.status,
          body: JSON.stringify({
            error: data.error?.message || 'Claude API request failed',
            details: data
          })
        };
      }

      console.log('Claude API success, response size:', JSON.stringify(data).length);

      // Return successful response
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      };

    } catch (fetchError) {
      clearTimeout(timeout);

      if (fetchError.name === 'AbortError') {
        console.error('Request timeout after 25s');
        return {
          statusCode: 504,
          body: JSON.stringify({
            error: 'Request timeout',
            message: 'Claude API took too long to respond (>25s). Try with a smaller image or simpler prompt.'
          })
        };
      }

      throw fetchError;
    }

  } catch (error) {
    console.error('Netlify Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NETLIFY_DEV ? error.stack : undefined
      })
    };
  }
};

// Export config for Netlify
exports.config = {
  name: 'transcribe',
  schedule: undefined,
  timeout: 26 // Maximum for free tier
};
