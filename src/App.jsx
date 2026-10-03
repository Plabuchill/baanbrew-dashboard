import { useEffect, useState } from 'react'
import Papa from 'papaparse'
import Lab1Dashboard from './Lab1Dashboard'
import Lab2Page from './lab2/Lab2Page'
import CustomersPage, { prepareCustomers } from './customers/CustomersPage'
import { prepareRows } from './lib/metrics'

const TABS = [
  { id: 'lab1', label: 'Lab 1 · Dashboard' },
  { id: 'lab22', label: 'Lab 2.2 · ซ่อมกราฟ' },
  { id: 'customers', label: 'ลูกค้าสมาชิก' },
]

const loadCsv = (url) =>
  new Promise((resolve, reject) =>
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: reject,
    }),
  )

function App() {
  const [tab, setTab] = useState(() => TABS.find((t) => '#' + t.id === location.hash)?.id ?? 'lab1')

  const choose = (id) => {
    setTab(id)
    history.replaceState(null, '', '#' + id)
  }

  return (
    <div className="min-h-screen bg-sky-50 text-stone-900">
      <nav className="sticky top-0 z-10 border-b border-blue-100 bg-sky-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => choose(t.id)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${
                tab === t.id ? 'bg-blue-600 text-white' : 'text-stone-600 hover:bg-blue-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'lab1' && <Lab1Dashboard />}
      {tab === 'lab22' && (
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Lab22 />
        </div>
      )}
      {tab === 'customers' && (
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Customers />
        </div>
      )}
    </div>
  )
}

// โหลด sales + products เฉพาะตอนเปิดแท็บ Lab 2.2
function Lab22() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([loadCsv('/sales.csv'), loadCsv('/products.csv')])
      .then(([sales, products]) => setData({ rows: prepareRows(sales), products }))
      .catch((e) => setError(e.message ?? String(e)))
  }, [])

  if (error) return <p className="text-red-700">โหลดข้อมูลไม่สำเร็จ: {error}</p>
  if (!data) return <p className="text-stone-500">กำลังโหลดข้อมูล...</p>
  return <Lab2Page rows={data.rows} products={data.products} />
}

// โหลด sales + customers_clean (ผลจาก Lab 2.1) เฉพาะตอนเปิดแท็บลูกค้า
function Customers() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([loadCsv('/sales.csv'), loadCsv('/customers_clean.csv')])
      .then(([sales, customers]) => setData({ rows: prepareRows(sales), customers: prepareCustomers(customers) }))
      .catch((e) => setError(e.message ?? String(e)))
  }, [])

  if (error) return <p className="text-red-700">โหลดข้อมูลไม่สำเร็จ: {error}</p>
  if (!data) return <p className="text-stone-500">กำลังโหลดข้อมูล...</p>
  return <CustomersPage rows={data.rows} customers={data.customers} />
}

export default App
