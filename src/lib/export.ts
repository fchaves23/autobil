// Exportação dos relatórios em Excel (.xlsx) e PDF.
// As bibliotecas são carregadas só quando a pessoa clica em exportar.
import type { Bucket } from './calc'
import { dateFull, parseDate } from './format'
import { KIND_LABEL, type Entry, type EntryKind } from './types'

export interface ReportExport {
  vehicleName: string
  vehiclePlate: string
  title: string // "Relatório geral" ou "Viagem Sul do Brasil"
  from: string
  to: string
  filters: string // ex.: "Todos os gastos · agrupado por mês"
  summary: [string, string][]
  groupLabel: string
  buckets: Bucket[]
  categories: { label: string; kind: EntryKind; amount: number }[]
  entries: Entry[]
  tripName: (id: string | null) => string
}

const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number | null, d = 0) => (n === null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }))

function fileBase(r: ReportExport) {
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
  return `autobil-${slug(r.vehicleName)}-${slug(r.title)}-${r.from}-a-${r.to}`
}

const periodText = (r: ReportExport) => (r.from === r.to ? dateFull(r.from) : `${dateFull(r.from)} a ${dateFull(r.to)}`)

function entryRow(e: Entry, r: ReportExport) {
  return {
    data: parseDate(e.date),
    tipo: KIND_LABEL[e.kind],
    categoria: e.category || '',
    valor: e.amount,
    litros: e.liters,
    preco: e.price_per_liter,
    km: e.odometer,
    cheio: e.kind === 'fuel' ? (e.full_tank ? 'Sim' : 'Não') : '',
    viagem: r.tripName(e.trip_id),
    por: e.user_name ?? '',
    obs: e.description || '',
  }
}

export async function exportXlsx(r: ReportExport) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const BRL = '"R$" #,##0.00'

  // Resumo
  const resumo: (string | number)[][] = [
    ['Autobil — ' + r.title],
    [],
    ['Carro', r.vehiclePlate ? `${r.vehicleName} (${r.vehiclePlate})` : r.vehicleName],
    ['Período', periodText(r)],
    ['Filtros', r.filters],
    [],
    ...r.summary,
  ]
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo)
  wsResumo['!cols'] = [{ wch: 22 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

  // Lançamentos
  const header = ['Data', 'Tipo', 'Categoria / combustível', 'Valor', 'Litros', 'Preço por litro', 'Hodômetro (km)', 'Tanque cheio', 'Viagem', 'Lançado por', 'Observação']
  const rows = [...r.entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const x = entryRow(e, r)
      return [x.data, x.tipo, x.categoria, x.valor, x.litros ?? '', x.preco ?? '', x.km ?? '', x.cheio, x.viagem, x.por, x.obs]
    })
  const wsEntries = XLSX.utils.aoa_to_sheet([header, ...rows], { cellDates: true })
  for (let i = 0; i < rows.length; i++) {
    const row = i + 2
    const d = wsEntries[`A${row}`]
    if (d) d.z = 'dd/mm/yyyy'
    const v = wsEntries[`D${row}`]
    if (v) v.z = BRL
    const p = wsEntries[`F${row}`]
    if (p && typeof p.v === 'number') p.z = '"R$" #,##0.000'
    const k = wsEntries[`G${row}`]
    if (k && typeof k.v === 'number') k.z = '#,##0'
  }
  wsEntries['!cols'] = [12, 14, 26, 14, 9, 14, 15, 12, 22, 18, 30].map((wch) => ({ wch }))
  wsEntries['!autofilter'] = { ref: `A1:K${rows.length + 1}` }
  XLSX.utils.book_append_sheet(wb, wsEntries, 'Lançamentos')

  // Por período
  const per = [[r.groupLabel, 'Combustível', 'Serviços', 'Despesas', 'Total'], ...r.buckets.map((b) => [b.long, b.fuel, b.service, b.expense, b.total])]
  const wsPer = XLSX.utils.aoa_to_sheet(per)
  for (let i = 0; i < r.buckets.length; i++) for (const c of ['B', 'C', 'D', 'E']) wsPer[`${c}${i + 2}`].z = BRL
  wsPer['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsPer, 'Por período')

  // Por categoria
  const cat = [['Categoria', 'Tipo', 'Valor'], ...r.categories.map((c) => [c.label, KIND_LABEL[c.kind], c.amount])]
  const wsCat = XLSX.utils.aoa_to_sheet(cat)
  for (let i = 0; i < r.categories.length; i++) wsCat[`C${i + 2}`].z = BRL
  wsCat['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsCat, 'Por categoria')

  XLSX.writeFile(wb, `${fileBase(r)}.xlsx`, { compression: true })
}

export async function exportPdf(r: ReportExport) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  const cobalt: [number, number, number] = [58, 91, 255]
  const ink: [number, number, number] = [15, 21, 36]
  const muted: [number, number, number] = [125, 134, 154]

  // Cabeçalho
  doc.setFillColor(...cobalt)
  doc.rect(0, 0, W, 64, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('auto', M, 41)
  doc.setTextColor(255, 178, 36)
  doc.text('bil', M + doc.getTextWidth('auto'), 41)

  doc.setTextColor(...ink)
  doc.setFontSize(18)
  doc.text(r.title, M, 100)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...muted)
  doc.text(`${r.vehiclePlate ? `${r.vehicleName} (${r.vehiclePlate})` : r.vehicleName}  ·  ${periodText(r)}`, M, 118)
  doc.text(r.filters, M, 133)

  const head = { fillColor: cobalt, textColor: 255, fontStyle: 'bold' as const }
  const base = { font: 'helvetica', fontSize: 9.5, cellPadding: 5, textColor: ink, lineColor: [227, 231, 240] as [number, number, number] }

  autoTable(doc, {
    startY: 150,
    theme: 'grid',
    styles: base,
    body: r.summary,
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 160 }, 1: { halign: 'right' } },
    margin: { left: M, right: M },
  })

  const after = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22

  const buckets = r.buckets.filter((b) => b.total > 0)
  autoTable(doc, {
    startY: after(),
    theme: 'striped',
    styles: base,
    headStyles: head,
    head: [[r.groupLabel, 'Combustível', 'Serviços', 'Despesas', 'Total']],
    body: buckets.map((b) => [b.long, money(b.fuel), money(b.service), money(b.expense), money(b.total)]),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: M, right: M },
  })

  autoTable(doc, {
    startY: after(),
    theme: 'striped',
    styles: base,
    headStyles: head,
    head: [['Para onde foi o dinheiro', 'Valor']],
    body: r.categories.map((c) => [c.label, money(c.amount)]),
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: M, right: M },
  })

  const list = [...r.entries].sort((a, b) => a.date.localeCompare(b.date))
  autoTable(doc, {
    startY: after(),
    theme: 'striped',
    styles: { ...base, fontSize: 8.5, cellPadding: 4 },
    headStyles: head,
    head: [['Data', 'Tipo', 'Categoria', 'Litros', 'Km', 'Viagem', 'Por', 'Valor']],
    body: list.map((e) => {
      const x = entryRow(e, r)
      return [dateFull(e.date), x.tipo, x.categoria, x.litros ? num(x.litros, 1) : '', x.km ? num(x.km) : '', x.viagem, x.por, money(x.valor)]
    }),
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: M, right: M },
  })

  // Rodapé com página
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8.5)
    doc.setTextColor(...muted)
    doc.text(`Gerado pelo Autobil em ${new Date().toLocaleDateString('pt-BR')}`, M, doc.internal.pageSize.getHeight() - 20)
    doc.text(`Página ${i} de ${pages}`, W - M, doc.internal.pageSize.getHeight() - 20, { align: 'right' })
  }

  doc.save(`${fileBase(r)}.pdf`)
}
