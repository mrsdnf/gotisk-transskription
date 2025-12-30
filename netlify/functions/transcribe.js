/**
 * Netlify Function: Claude Vision API Proxy
 *
 * This function acts as a server-side proxy to avoid CORS issues
 * when calling the Claude API from the browser.
 */

exports.handler = async (event, context) => {
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

    // Call Claude API
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
                media_type: 'image/png',
                data: image
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      })
    });

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

    // Return successful response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Netlify Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
