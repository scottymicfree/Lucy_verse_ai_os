export type ActionContext = {
  window?: any;
  log?: (msg: string) => void;
};

export type LucyAction = {
  id: string;
  label: string;
  keywords: string[];
  run: (ctx: ActionContext) => Promise<void>;
};

export const actions: LucyAction[] = [
  {
    id: "organize-downloads",
    label: "Organize Downloads",
    keywords: ["organize", "clean", "downloads", "sort"],
    run: async (ctx) => {
      ctx.log?.("Organizing Downloads folder...");
      if (!(window as any).lucyOS) throw new Error("OS integration not available");
      const cmd = "powershell";
      const args = [
        "-Command",
        `
        $dir = "$env:USERPROFILE\\Downloads";
        if (!(Test-Path $dir)) { exit 1; }
        $exts = @{
          'Images' = @('.jpg','.jpeg','.png','.gif','.bmp');
          'Documents' = @('.pdf','.doc','.docx','.txt','.xlsx');
          'Audio' = @('.mp3','.wav','.flac');
        };
        foreach ($folder in $exts.Keys) {
          $path = Join-Path $dir $folder;
          if (!(Test-Path $path)) { New-Item -ItemType Directory -Path $path > $null; }
          foreach ($ext in $exts[$folder]) {
            Move-Item -Path "$dir\\*$ext" -Destination $path -ErrorAction SilentlyContinue;
          }
        }
        `
      ];
      const res = await (window as any).lucyOS.requestCapability("legacy:process:execute", { cwd: "C:/", cmd, flags: args });
      ctx.log?.(res.stdout || "Downloads organized successfully.");
      if (res.stderr) ctx.log?.(`Warning: ${res.stderr}`);
    },
  },
  {
    id: "rename-files-pattern",
    label: "Rename Files by Pattern",
    keywords: ["rename", "batch", "files", "pattern"],
    run: async (ctx) => {
      const folder = prompt("Enter full folder path to rename files in:");
      if (!folder) {
        ctx.log?.("Rename cancelled.");
        return;
      }
      const prefix = prompt("Enter the new prefix for the files:");
      if (!prefix) {
        ctx.log?.("Rename cancelled.");
        return;
      }
      ctx.log?.(`Renaming files in ${folder} to prefix '${prefix}'...`);
      if (!(window as any).lucyOS) throw new Error("OS integration not available");
      const cmd = "powershell";
      const args = [
        "-Command",
        `
        $folder = "${folder}";
        $prefix = "${prefix}";
        if (Test-Path $folder) {
          $files = Get-ChildItem -Path $folder -File;
          $i = 1;
          foreach ($file in $files) {
            $newName = "{0}_{1:D3}{2}" -f $prefix, $i, $file.Extension;
            Rename-Item -Path $file.FullName -NewName $newName;
            $i++;
          }
          Write-Output "Renamed $($files.Count) files.";
        } else {
          Write-Error "Folder not found.";
        }
        `
      ];
      const res = await (window as any).lucyOS.requestCapability("legacy:process:execute", { cwd: "C:/", cmd, flags: args });
      ctx.log?.(res.stdout || "Done.");
      if (res.stderr) ctx.log?.(`Error: ${res.stderr}`);
    },
  },
  {
    id: "open-projects-folder",
    label: "Open Projects Folder",
    keywords: ["open", "projects", "folder", "code"],
    run: async (ctx) => {
      ctx.log?.("Opening Documents...");
      if (!(window as any).lucyOS) throw new Error("OS integration not available");
      await (window as any).lucyOS.openPath("C:/Users/Randy/Documents");
    },
  },
  {
    id: "search-in-folder",
    label: "Search in Folder",
    keywords: ["search", "find", "folder", "grep"],
    run: async (ctx) => {
      const folder = prompt("Enter folder path to search:");
      if (!folder) return;
      const term = prompt("Enter search term:");
      if (!term) return;
      ctx.log?.(`Searching for '${term}' in ${folder}...`);
      if (!(window as any).lucyOS) throw new Error("OS integration not available");
      const cmd = "powershell";
      const args = ["-Command", `Get-ChildItem -Path "${folder}" -Recurse -File | Select-String -Pattern "${term}" | Select-Object -First 10`];
      const res = await (window as any).lucyOS.requestCapability("legacy:process:execute", { cwd: "C:/", cmd, flags: args });
      ctx.log?.(res.stdout || "No matches found.");
      if (res.stderr) ctx.log?.(`Error: ${res.stderr}`);
    },
  },
  {
    id: "install-dropped-app",
    label: "Install Dropped App",
    keywords: ["install", "app", "npm", "pip", "dependencies"],
    run: async (ctx) => {
      const folder = prompt("Enter folder path of the app to install:");
      if (!folder) return;
      ctx.log?.(`Installing dependencies in ${folder}...`);
      if (!(window as any).lucyOS) throw new Error("OS integration not available");
      
      const dirContents = await (window as any).lucyOS.listDir(folder);
      const isNode = dirContents.some((e: any) => e.name === "package.json");
      const isPython = dirContents.some((e: any) => e.name === "requirements.txt" || e.name === "pyproject.toml");

      if (isNode) {
        ctx.log?.("Node.js project detected. Running npm install...");
        const res = await (window as any).lucyOS.requestCapability("legacy:process:execute", { cwd: folder, cmd: "npm", flags: ["install"] });
        ctx.log?.(res.stdout || "npm install completed.");
        if (res.stderr) ctx.log?.(`Warning/Error: ${res.stderr}`);
      } else if (isPython) {
        ctx.log?.("Python project detected. Running pip install...");
        const res = await (window as any).lucyOS.requestCapability("legacy:process:execute", { cwd: folder, cmd: "pip", flags: ["install", "-r", "requirements.txt"] });
        ctx.log?.(res.stdout || "pip install completed.");
        if (res.stderr) ctx.log?.(`Warning/Error: ${res.stderr}`);
      } else {
        ctx.log?.("No package.json or requirements.txt found.");
      }
    },
  },
  {
    id: "clean-temp-files",
    label: "Clean Temp Files",
    keywords: ["clean", "temp", "cache", "trash"],
    run: async (ctx) => {
      ctx.log?.("Cleaning Temp files older than 7 days...");
      if (!(window as any).lucyOS) throw new Error("OS integration not available");
      const cmd = "powershell";
      const args = [
        "-Command",
        `
        $limit = (Get-Date).AddDays(-7);
        $temp = $env:TEMP;
        $files = Get-ChildItem -Path $temp -Recurse -File | Where-Object { $_.LastWriteTime -lt $limit };
        $count = 0;
        foreach ($file in $files) {
          Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue;
          $count++;
        }
        Write-Output "Removed $count old temp files.";
        `
      ];
      const res = await (window as any).lucyOS.requestCapability("legacy:process:execute", { cwd: "C:/", cmd, flags: args });
      ctx.log?.(res.stdout || "Clean complete.");
      if (res.stderr) ctx.log?.(`Warning: ${res.stderr}`);
    },
  },
  {
    id: "open-recent-files",
    label: "Open Recent Files",
    keywords: ["open", "recent", "files", "history"],
    run: async (ctx) => {
      ctx.log?.("Opening Recent Files folder...");
      if (!(window as any).lucyOS) throw new Error("OS integration not available");
      await (window as any).lucyOS.openPath("shell:Recent");
      ctx.log?.("Recent files folder opened.");
    },
  },
  {
    id: "launch-ame-engine",
    label: "Launch Alpha Matrix Engine",
    keywords: ["launch", "engine", "alpha", "matrix", "ame", "3d"],
    run: async (ctx) => {
      ctx.log?.("Booting Alpha Matrix Engine (Port 3005)...");
      if (!(window as any).lucyOS) throw new Error("OS integration not available");
      
      const res = await (window as any).lucyOS.requestCapability("engine:launch", { 
        cwd: "C:/Users/Randy Webb/Desktop/Os_lucy/OS_Lucy's/ame.lucy's engine", 
        cmd: "npm", 
        flags: ["run", "dev"] 
      });
      
    },
  },
  {
    id: "get-top-spotify-tracks",
    label: "Get Top Spotify Tracks",
    keywords: ["spotify", "music", "top", "tracks", "dj"],
    run: async (ctx) => {
      ctx.log?.("Fetching Top Spotify Tracks...");
      const token = prompt("Enter your Spotify Bearer Authorization Token:");
      if (!token) {
        ctx.log?.("Spotify request cancelled (no token provided).");
        return;
      }
      
      async function fetchWebApi(endpoint: string, method: string, body?: any) {
        const res = await fetch(`https://api.spotify.com/${endpoint}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          method,
          body: body ? JSON.stringify(body) : undefined
        });
        if (!res.ok) throw new Error(`Spotify API Error: ${res.status}`);
        return await res.json();
      }

      try {
        const data = await fetchWebApi('v1/me/top/tracks?time_range=long_term&limit=5', 'GET');
        const topTracks = data.items;
        
        if (!topTracks || topTracks.length === 0) {
          ctx.log?.("No top tracks found.");
          return;
        }

        const trackStrings = topTracks.map(
          ({name, artists}: any) =>
            `${name} by ${artists.map((artist: any) => artist.name).join(', ')}`
        );
        
        ctx.log?.("Your Top Tracks:\n" + trackStrings.join("\n"));
      } catch (err: any) {
        ctx.log?.(`Failed to fetch tracks: ${err.message}`);
      }
    },
  }
];
