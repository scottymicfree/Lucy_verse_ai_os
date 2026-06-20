import * as vm from 'vm';

export const WasmSandbox = {
  execute: (untrustedCode: string, virtualState: any) => {
    // 1. Create a completely isolated context
    const sandbox = {
      console: { log: (msg: string) => virtualState.logs.push(msg) },
      fetch: () => { throw new Error("Network Access Denied in Sandbox"); }
    };
    
    vm.createContext(sandbox);
    
    // 2. Execute
    try {
      const script = new vm.Script(untrustedCode);
      script.runInContext(sandbox, { timeout: 1000 }); // Hard 1s timeout
      return { success: true, logs: virtualState.logs };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};
