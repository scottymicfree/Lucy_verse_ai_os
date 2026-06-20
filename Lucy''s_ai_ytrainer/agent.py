import sys
import os
import json
import re
from typing import Dict, List, Any
import ollama

import tools

SYSTEM_PROMPT = """You are "ollama-coder", an advanced agentic coding assistant.
You can read, write, and list files in the current workspace using tool calls.

You have access to the following tools:
1. `list_files` - Lists all files in the current directory recursively.
   Usage format:
   Action: list_files
   ActionInput: {}

2. `read_file` - Reads the contents of a specific file.
   Usage format:
   Action: read_file
   ActionInput: {"path": "relative/path/to/file.py"}

3. `write_file` - Writes content to a specific file.
   Usage format:
   Action: write_file
   ActionInput: {"path": "relative/path/to/file.py", "content": "file content here"}

When you need to perform an action, output your thoughts followed by the action format:
Thought: <your reasoning here>
Action: <tool_name>
ActionInput: <arguments in JSON or empty string>

After the user provides the Observation of the tool, you will continue the cycle.
Once you have finished the task and do not need to call any more tools, output your final answer:
Thought: <final reasoning>
Final Answer: <your final response summarizing the changes made>

Make sure your Actions exactly match one of the three formats above. Do not output multiple actions in a single turn.
"""

def parse_action(text: str) -> tuple[str | None, str | None]:
    """Parses Thought, Action, and ActionInput from model response."""
    action_match = re.search(r"Action:\s*(\w+)", text)
    action_input_match = re.search(r"ActionInput:\s*(.*)", text, re.DOTALL)
    
    action = action_match.group(1).strip() if action_match else None
    action_input_str = action_input_match.group(1).strip() if action_input_match else None
    
    return action, action_input_str

def execute_tool(action: str, action_input_str: str) -> str:
    """Executes the mapped tool based on parsed action and inputs."""
    print(f"\n[AGENT TOOL CALL] Executing: {action} with input {action_input_str}")
    if action == "list_files":
        return tools.list_files(".")
    
    try:
        # Action input can be JSON
        args = json.loads(action_input_str) if action_input_str else {}
    except Exception:
        # Fallback to string if JSON parsing fails
        args = {"path": action_input_str}

    if action == "read_file":
        path = args.get("path", "").strip()
        if not path:
            return "Error: Path parameter is missing."
        return tools.read_file(path)
    
    elif action == "write_file":
        path = args.get("path", "").strip()
        content = args.get("content", "")
        if not path:
            return "Error: Path parameter is missing."
        return tools.write_file(path, content)
    
    else:
        return f"Error: Unknown tool {action}."

def run_agent_loop(user_prompt: str, model_name: str = "ollama-coder"):
    """Runs the main agent ReAct execution loop."""
    print(f"\nInitializing agent execution using model: {model_name}...")
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]
    
    max_turns = 10
    for turn in range(max_turns):
        print(f"\n--- Agent Turn {turn + 1}/{max_turns} ---")
        try:
            response = ollama.chat(model=model_name, messages=messages)
        except Exception as e:
            print(f"Error connecting to Ollama: {str(e)}")
            print("Please ensure Ollama is running (`ollama serve`) and the model exists.")
            return
            
        content = response["message"]["content"]
        print(content)
        
        # Append assistant's response to history
        messages.append({"role": "assistant", "content": content})
        
        # Check if we have a final answer
        if "Final Answer:" in content:
            print("\n[AGENT SUCCESS] Task completed.")
            break
            
        action, action_input_str = parse_action(content)
        if action:
            observation = execute_tool(action, action_input_str)
            print(f"[AGENT OBSERVED] Result:\n{observation}")
            # Feed observation back as user message
            messages.append({"role": "user", "content": f"Observation:\n{observation}"})
        else:
            if "Action:" not in content and "Final Answer:" not in content:
                print("\n[AGENT WARNING] Model did not provide an Action or Final Answer. Terminating loop.")
                break

if __name__ == "__main__":
    if len(sys.argv) > 1:
        prompt = " ".join(sys.argv[1:])
    else:
        prompt = input("Enter a coding task for ollama-coder: ")
    
    run_agent_loop(prompt)
