import { NextResponse } from 'next/server';

const ADK_SERVER_URL = 'http://127.0.0.1:8000';
const USER_ID = 'web_user';
const APP_NAME = 'root_agent';

interface EventPart {
  text?: string;
  functionCall?: {
    name: string;
    args: any;
    id: string;
  };
  functionResponse?: {
    name: string;
    response: any;
    id: string;
  };
}

interface Event {
  author: string;
  role?: string;
  content?: {
    parts?: EventPart[];
    role?: string;
  };
  actions?: {
    transferToAgent?: string;
    [key: string]: any;
  };
  timestamp?: number;
}

export async function POST(req: Request) {
  try {
    const { message, sessionId } = await req.json();

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'Missing message or sessionId' },
        { status: 400 }
      );
    }

    // 1. Ensure the session exists on the ADK server
    const sessionCheckUrl = `${ADK_SERVER_URL}/apps/${APP_NAME}/users/${USER_ID}/sessions/${sessionId}`;
    let sessionExists = false;
    
    try {
      const checkRes = await fetch(sessionCheckUrl, { method: 'GET', cache: 'no-store' });
      if (checkRes.ok) {
        sessionExists = true;
      }
    } catch (err) {
      console.warn('Failed to verify session existence, attempting to create one anyway.', err);
    }

    if (!sessionExists) {
      const createSessionUrl = `${ADK_SERVER_URL}/apps/${APP_NAME}/users/${USER_ID}/sessions`;
      try {
        const createRes = await fetch(createSessionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          console.error('Session creation failed:', errData);
        }
      } catch (err) {
        console.error('Failed to connect to ADK server during session creation:', err);
        return NextResponse.json(
          { error: 'Could not connect to ADK server. Please ensure the agent server is running.' },
          { status: 503 }
        );
      }
    }

    // 2. Run the agent with the user's message
    const runUrl = `${ADK_SERVER_URL}/run`;
    let responseEvents: Event[] = [];

    try {
      const runRes = await fetch(runUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_name: APP_NAME,
          user_id: USER_ID,
          session_id: sessionId,
          new_message: {
            role: 'user',
            parts: [{ text: message }],
          },
        }),
      });

      if (!runRes.ok) {
        const errorText = await runRes.text();
        console.error('Agent run failed with status:', runRes.status, errorText);
        return NextResponse.json(
          { error: `Agent run failed: ${errorText || runRes.statusText}` },
          { status: runRes.status }
        );
      }

      responseEvents = await runRes.json();
    } catch (err) {
      console.error('Failed to run agent:', err);
      return NextResponse.json(
        { error: 'Error calling the agent run endpoint. Please check the backend server logs.' },
        { status: 500 }
      );
    }

    // 3. Parse the events to extract the final answer and thought process
    let finalAnswer = '';
    const thoughts: Array<{ agent: string; type: string; details: string }> = [];

    // Traverse the events from start to finish to log thoughts
    for (const event of responseEvents) {
      const author = event.author || 'agent';

      // Check if control was handed off to a sub-agent
      if (event.actions?.transferToAgent) {
        thoughts.push({
          agent: author,
          type: 'handoff',
          details: `Transferred control to ${event.actions.transferToAgent}`,
        });
      }

      if (event.content?.parts) {
        for (const part of event.content.parts) {
          if (part.functionCall) {
            thoughts.push({
              agent: author,
              type: 'tool_call',
              details: `Calling tool "${part.functionCall.name}" with arguments: ${JSON.stringify(part.functionCall.args)}`,
            });
          }
          if (part.functionResponse) {
            thoughts.push({
              agent: author,
              type: 'tool_response',
              details: `Tool "${part.functionResponse.name}" returned: ${JSON.stringify(part.functionResponse.response)}`,
            });
          }
          if (part.text && author !== 'user') {
            // Keep updating the final answer with the latest text response
            finalAnswer = part.text;
          }
        }
      }
    }

    if (!finalAnswer) {
      finalAnswer = "The agent did not provide a text response. Please check the thought process below for details.";
    }

    return NextResponse.json({
      answer: finalAnswer,
      thoughts,
    });

  } catch (error: any) {
    console.error('Unhandled error in chat route:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const healthRes = await fetch(`${ADK_SERVER_URL}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (healthRes.ok) {
      return NextResponse.json({ status: 'ok' });
    }
  } catch (err) {
    // Ignore error
  }
  return NextResponse.json({ status: 'error', error: 'ADK server offline' }, { status: 503 });
}

