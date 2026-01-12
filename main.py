# middleware/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import asyncio
import json
import uuid
from typing import Optional

# Gemini AI Integration
import sys
print(f"[SYSTEM] Python version: {sys.version}")
print(f"[SYSTEM] Python executable: {sys.executable}")

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
    print("[GEMINI] ✓ Successfully imported google.generativeai")
except (ImportError, TypeError) as e:
    GEMINI_AVAILABLE = False
    print(f"[WARNING] google-generativeai not available: {e}")
    print(f"[WARNING] Error type: {type(e).__name__}")
    import traceback
    traceback.print_exc()
    print("[INFO] Server will start but Gemini features will be disabled.")
    print("[INFO] Consider using Python 3.11 or 3.12 for full Gemini support.")

# 1. LOAD API KEYS
# Load .env from the middleWARE directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
LICENSE_DB_PATH = os.getenv("LICENSE_DB_PATH", "license.db")  # PostgreSQL connection string or SQLite path

# Debug: Print key status (first 10 chars only for security)
if GEMINI_KEY:
    print(f"[CONFIG] GEMINI_API_KEY loaded: {GEMINI_KEY[:10]}...")
else:
    print("[CONFIG] WARNING: GEMINI_API_KEY not found in .env file")

app = FastAPI(title="Wyronix Core")

# Session storage (in production, use Redis or database)
session_store = {}  # {session_id: {"project_idea": str, "created_at": datetime}}

# 2. CORS SETUP
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
async def health_check():
    # Check if keys are loaded
    key_status = "Keys Loaded" if GEMINI_KEY else "Keys Missing"
    gemini_status = "Available" if GEMINI_AVAILABLE else "Not Installed"
    import sys
    return {
        "status": "online",
        "security": key_status,
        "gemini": gemini_status,
        "python_version": sys.version.split()[0],
        "python_executable": sys.executable
    }

@app.post("/api/v1/start")
async def start_protocol(data: dict, license_key: Optional[str] = Header(None, alias="License-Key")):
    """
    @wyronix-module: Gateway Protocol
    Complexity: O(1) - Simple UUID generation and validation
    """
    project_idea = data.get('project_idea', '')
    if not project_idea:
        raise HTTPException(status_code=400, detail="project_idea is required")
    
    # License verification (stub - replace with real DB check)
    if license_key:
        # TODO: Verify license_key against PostgreSQL database
        # For now, accept any non-empty key as valid
        is_valid = await verify_license(license_key)
        if not is_valid:
            raise HTTPException(status_code=403, detail="Invalid license key")
    else:
        # Free tier: allow but track quota on frontend
        pass
    
    # Generate UUID session ID
    session_id = str(uuid.uuid4())
    
    # Store session data
    session_store[session_id] = {
        "project_idea": project_idea,
        "license_key": license_key
    }
    
    print(f"[CORE] Sequence Started: {project_idea[:50]}... | Session: {session_id}")
    
    return {
        "session_id": session_id,
        "status": "active"
    }

async def verify_license(license_key: str) -> bool:
    """
    @wyronix-module: License Verification
    Complexity: O(1) - Database lookup
    TODO: Implement PostgreSQL query to check license_key and Stripe subscription status
    """
    # Stub implementation - replace with real DB query
    # Example: SELECT is_active, stripe_status FROM licenses WHERE license_key = ?
    return len(license_key) > 0  # Temporary: accept any non-empty key

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    @wyronix-module: Neural Link Gateway
    Complexity: O(n) - Streaming response length
    """
    await websocket.accept()
    
    # Confirm Connection
    await websocket.send_text(json.dumps({
        "agent": "SEARCH",
        "content": "Secure Uplink Established.",
        "metrics": None
    }))
    
    try:
        # Get project idea from session storage
        if session_id not in session_store:
            await websocket.send_text(json.dumps({
                "agent": "ERROR",
                "content": "Invalid session ID. Please restart the protocol.",
                "metrics": None
            }))
            await websocket.close()
            return
        
        session_data = session_store[session_id]
        project_idea = session_data.get("project_idea", "")
        
        if not GEMINI_AVAILABLE:
            await websocket.send_text(json.dumps({
                "agent": "ERROR",
                "content": "Gemini library not available. Please install: pip install google-generativeai",
                "metrics": None
            }))
            await websocket.close()
            return
        
        if not GEMINI_KEY:
            await websocket.send_text(json.dumps({
                "agent": "ERROR",
                "content": "Gemini API key not configured. Please set GEMINI_API_KEY in .env file",
                "metrics": None
            }))
            await websocket.close()
            return
        
        print(f"[GEMINI] Initializing with API key: {GEMINI_KEY[:10]}...")
        
        # Initialize Gemini
        try:
            genai.configure(api_key=GEMINI_KEY)
            model = genai.GenerativeModel('gemini-1.5-pro')
            print(f"[GEMINI] Model initialized successfully")
        except Exception as e:
            await websocket.send_text(json.dumps({
                "agent": "ERROR",
                "content": f"Failed to initialize Gemini: {str(e)}",
                "metrics": None
            }))
            await websocket.close()
            return
        
        # Stage 1: Market Intelligence (SEARCH)
        search_prompt = f"""Analyze the market potential for this idea: {project_idea}
        
Provide real-time intelligence on:
- Market demand indicators
- Competitive landscape
- Key trends and opportunities

Format your response as concise, actionable insights."""
        
        try:
            search_response = model.generate_content(search_prompt, stream=True)
            print(f"[GEMINI] Streaming search response...")
            full_text = ""
            chunk_count = 0
            for chunk in search_response:
                chunk_text = ""
                if hasattr(chunk, 'text'):
                    chunk_text = chunk.text
                elif hasattr(chunk, 'parts'):
                    chunk_text = "".join([part.text for part in chunk.parts if hasattr(part, 'text')])
                
                if chunk_text:
                    full_text += chunk_text
                    chunk_count += 1
                    await websocket.send_text(json.dumps({
                        "agent": "SEARCH",
                        "content": chunk_text,
                        "metrics": None
                    }))
                    await asyncio.sleep(0.05)  # Throttle for smooth streaming
            
            print(f"[GEMINI] Search complete. Total length: {len(full_text)} chars, {chunk_count} chunks")
            if not full_text:
                await websocket.send_text(json.dumps({
                    "agent": "SEARCH",
                    "content": "Market analysis initiated...",
                    "metrics": None
                }))
        except Exception as e:
            print(f"[ERROR] Gemini search failed: {e}")
            import traceback
            traceback.print_exc()
            await websocket.send_text(json.dumps({
                "agent": "ERROR",
                "content": f"Gemini API error during search: {str(e)}",
                "metrics": None
            }))
            return  # Don't raise, just return to close gracefully
        
        # Stage 2: Strategic Analyst (ANALYST)
        analyst_prompt = f"""Evaluate the strategic viability of this business idea: {project_idea}

You must respond ONLY with valid JSON, no other text. Format:
{{
    "heat": 75,
    "roi": 68,
    "verdict": "Strong market opportunity with moderate ROI potential."
}}

Provide:
- heat: Market Heat Score (0-100 integer) - Demand and market opportunity
- roi: ROI Viability Score (0-100 integer) - Return on investment potential  
- verdict: One-sentence strategic recommendation

Respond with ONLY the JSON object, no markdown, no explanations."""
        
        try:
            analyst_response = model.generate_content(analyst_prompt)
            analyst_text = analyst_response.text.strip()
            print(f"[GEMINI] Analyst response received: {len(analyst_text)} chars")
        except Exception as e:
            print(f"[ERROR] Gemini analyst failed: {e}")
            await websocket.send_text(json.dumps({
                "agent": "ERROR",
                "content": f"Gemini API error during analysis: {str(e)}",
                "metrics": None
            }))
            return
        
        # Parse JSON from response (handle markdown code blocks)
        try:
            # Clean up the response
            analyst_text = analyst_text.strip()
            if "```json" in analyst_text:
                analyst_text = analyst_text.split("```json")[1].split("```")[0].strip()
            elif "```" in analyst_text:
                analyst_text = analyst_text.split("```")[1].split("```")[0].strip()
            
            # Try to find JSON object in the text
            import re
            json_match = re.search(r'\{[^{}]*"heat"[^{}]*\}', analyst_text)
            if json_match:
                analyst_text = json_match.group(0)
            
            metrics = json.loads(analyst_text)
            heat = int(metrics.get("heat", 50))
            roi = int(metrics.get("roi", 50))
            verdict = metrics.get("verdict", "Analysis complete")
            print(f"[GEMINI] Parsed metrics - Heat: {heat}, ROI: {roi}")
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            print(f"[WARNING] JSON parsing failed: {e}")
            print(f"[WARNING] Raw response: {analyst_text[:200]}")
            # Fallback if JSON parsing fails
            heat = 50
            roi = 50
            verdict = "Analysis complete - parsing error occurred"
        
        await websocket.send_text(json.dumps({
            "agent": "ANALYST",
            "content": f"Strategic analysis complete. Heat: {heat}%, ROI: {roi}%",
            "metrics": {
                "heat": heat,
                "roi": roi,
                "verdict": verdict
            }
        }))
        
        # Stage 3: Solution Architect (DEV)
        dev_prompt = f"""Generate a technical architecture for: {project_idea}

Provide:
1. File tree structure (list of key files/directories)
2. Core code implementation (show main files with syntax highlighting)

Format as JSON:
{{
    "files": ["file1.py", "file2.js", ...],
    "code": "// Main implementation code here"
}}"""
        
        dev_response = model.generate_content(dev_prompt)
        dev_text = dev_response.text.strip()
        
        # Parse file tree and code
        try:
            if "```json" in dev_text:
                dev_data = json.loads(dev_text.split("```json")[1].split("```")[0].strip())
            elif "```" in dev_text:
                dev_data = json.loads(dev_text.split("```")[1].split("```")[0].strip())
            else:
                dev_data = json.loads(dev_text)
            
            files = dev_data.get("files", [])
            code = dev_data.get("code", "")
        except (json.JSONDecodeError, KeyError):
            files = ["main.py", "config.json"]
            code = "# Implementation code\n"
        
        # Send files one by one
        for filename in files:
            await websocket.send_text(json.dumps({
                "agent": "DEV",
                "content": None,
                "file": filename,
                "code": None
            }))
            await asyncio.sleep(0.1)
        
        # Send code preview
        await websocket.send_text(json.dumps({
            "agent": "DEV",
            "content": None,
            "file": None,
            "code": code
        }))
        
        # Completion signal
        await websocket.send_text(json.dumps({
            "agent": "COMPLETE",
            "content": "Sequence complete. All modules processed.",
            "metrics": None
        }))
        
    except WebSocketDisconnect:
        print(f"[CORE] WebSocket disconnected: {session_id}")
    except Exception as e:
        print(f"[ERROR] WebSocket error: {e}")
        try:
            await websocket.send_text(json.dumps({
                "agent": "ERROR",
                "content": f"Processing error: {str(e)}",
                "metrics": None
            }))
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass