/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '*.css' {
  const content: Record<string, string>
  export default content
}

// element-plus CSS side-effect import
declare module 'element-plus/dist/index.css' {}

interface Window {
  electronAPI?: {
    exportFile: (opts: { defaultName: string; buffer: number[] }) => Promise<{ ok: boolean; filePath?: string; error?: string }>
    backupSave: (opts: { jsonStr: string }) => Promise<{ ok: boolean; filePath?: string; error?: string }>
    backupLoad: () => Promise<{ ok: boolean; content?: string; error?: string }>
    printReceipt: () => Promise<{ ok: boolean; reason?: string }>
    openPath: (opts: { filePath: string }) => Promise<{ ok: boolean }>
    isElectron: boolean
  }
}
