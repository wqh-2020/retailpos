import * as XLSX from 'xlsx'

/** 导出数据到 Excel
 *  使用 XLSX.writeFileXLSX 直接写入文件，避免 Electron IPC 传递大 buffer 导致数据丢失
 */
export async function exportToExcel(
  data: Record<string, unknown>[],
  sheetName: string,
  fileName: string
): Promise<void> {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFileXLSX(wb, fileName)
}

/** 解析 Excel 文件 */
export function parseExcel(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
