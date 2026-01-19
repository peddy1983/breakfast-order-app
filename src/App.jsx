// src/App.jsx - v6.0 管理員功能完整版 (無亂碼)
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)
  
  // 使用者狀態
  const [cart, setCart] = useState({}) 
  const [drinkTemps, setDrinkTemps] = useState({}) 
  const [name, setName] = useState('')
  const [activeTab, setActiveTab] = useState('')
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 管理員狀態
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false)
  const [adminOrders, setAdminOrders] = useState([]) // 管理員看到的訂單列表

  // 1. 初始化
  useEffect(() => {
    fetchMenu()
  }, [])

  // 每次登入或刪除訂單後，重新抓取訂單列表
  useEffect(() => {
    if (isAdminLoggedIn) {
      fetchAdminOrders()
    }
  }, [isAdminLoggedIn])

  async function fetchMenu() {
    try {
      const { data, error } = await supabase.from('menu_items').select('*').order('id')
      if (error) throw error
      setMenu(data || [])
      if (data && data.length > 0) setActiveTab(data[0].category)
    } catch (error) {
      console.error(error)
      alert('菜單讀取失敗')
    } finally {
      setLoading(false)
    }
  }

  // --- 購物車邏輯 ---
  const categories = [...new Set(menu.map(item => item.category))]
  const currentItems = menu.filter(item => item.category === activeTab)

  const updateQty = (itemId, delta) => {
    setCart(prev => {
      const currentQty = prev[itemId] || 0
      const newQty = Math.max(0, currentQty + delta)
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [itemId]: newQty }
    })
  }

  const handleTempChange = (itemId, val) => {
    setDrinkTemps(prev => ({ ...prev, [itemId]: val }))
  }

  const calculateTotal = () => {
    return Object.entries(cart).reduce((sum, [itemId, qty]) => {
      const item = menu.find(m => m.id === parseInt(itemId))
      return sum + (item ? item.price * qty : 0)
    }, 0)
  }

  const getCartItemsDetails = () => {
    return Object.entries(cart).map(([itemId, qty]) => {
      const item = menu.find(m => m.id === parseInt(itemId))
      const isDrink = item.category === '飲料' || item.name.includes('紅') || item.name.includes('綠') || item.name.includes('茶') || item.name.includes('奶') || item.name.includes('咖') || item.name.includes('飲')
      const temp = isDrink ? (drinkTemps[itemId] || '冰') : null
      const finalName = temp ? `${item.name} (${temp})` : item.name
      return { ...item, qty, temp, finalName }
    })
  }

  const submitOrder = async () => {
    if (!name.trim()) return alert('請輸入您的名稱！')
    setSubmitting(true)
    
    // 準備資料
    const orderDetails = getCartItemsDetails().map(item => ({
      id: item.id,
      name: item.finalName,
      price: item.price,
      qty: item.qty
    }))

    const { error } = await supabase.from('orders').insert({
      customer_name: name,
      order_details: orderDetails,
      total_price: calculateTotal()
    })

    if (error) {
      alert('送出失敗: ' + error.message)
    } else {
      alert('✅ 訂單已送出！')
      setCart({})
      setDrinkTemps({})
      setIsReviewOpen(false)
      setName('')
    }
    setSubmitting(false)
  }

  // --- 管理員功能 ---

  const handleAdminLogin = () => {
    if (isAdminLoggedIn) {
      setIsAdminLoggedIn(false) // 登出
      return
    }
    const pwd = prompt('請輸入管理員密碼：')
    if (pwd === '1234') { // 這裡設定你的密碼
      setIsAdminLoggedIn(true)
    } else if (pwd !== null) {
      alert('密碼錯誤')
    }
  }

  async function fetchAdminOrders() {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (error) console.error(error)
    else setAdminOrders(data || [])
  }

  // 刪除整筆訂單
  const deleteOrder = async (orderId) => {
    if (!confirm('確定要刪除這筆訂單嗎？無法復原喔！')) return
    const { error } = await supabase.from('orders').delete().eq('id', orderId)
    if (error) alert('刪除失敗')
    else fetchAdminOrders() // 重新整理列表
  }

  // 刪除訂單中的單一品項
  const deleteOrderItem = async (order, itemIndex) => {
    if (!confirm('確定要刪除這個品項嗎？')) return

    // 1. 取得舊的 details (記得處理 JSON 可能是字串的問題)
    let details = typeof order.order_details === 'string' ? JSON.parse(order.order_details) : order.order_details
    
    // 2. 移除該品項
    const removedItem = details[itemIndex]
    const newDetails = details.filter((_, index) => index !== itemIndex)
    
    // 3. 重新計算總金額
    const newTotal = order.total_price - (removedItem.price * removedItem.qty)

    // 4. 如果刪光了，直接刪除整筆訂單
    if (newDetails.length === 0) {
      await deleteOrder(order.id)
      return
    }

    // 5. 更新資料庫
    const { error } = await supabase.from('orders').update({
      order_details: newDetails,
      total_price: newTotal
    }).eq('id', order.id)

    if (error) alert('更新失敗')
    else fetchAdminOrders()
  }

  // --- 報表列印功能 (HTML 模式 - 解決亂碼) ---
  
  const printVendorReport = () => {
    if (adminOrders.length === 0) return alert('無訂單')

    // 統計資料
    const summary = {}
    let totalRevenue = 0
    adminOrders.forEach(order => {
      const details = typeof order.order_details === 'string' ? JSON.parse(order.order_details) : order.order_details
      details.forEach(item => {
        if (!summary[item.name]) summary[item.name] = { qty: 0, price: item.price }
        summary[item.name].qty += item.qty
        totalRevenue += (item.price * item.qty)
      })
    })

    // 開啟新視窗列印
    const win = window.open('', '', 'width=800,height=600')
    win.document.write(`
      <html>
        <head>
          <title>店家製作總表</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total { font-size: 1.5rem; font-weight: bold; margin-top: 20px; text-align: right; }
          </style>
        </head>
        <body>
          <h2>店家製作總表 (Vendor Report)</h2>
          <p>列印時間: ${new Date().toLocaleString()}</p>
          <table>
            <thead><tr><th>品項名稱</th><th>總數量</th><th>小計</th></tr></thead>
            <tbody>
              ${Object.entries(summary).map(([name, info]) => `
                <tr>
                  <td>${name}</td>
                  <td>${info.qty}</td>
                  <td>$${info.price * info.qty}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">總營業額: $${totalRevenue}</div>
          <script>window.print();</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  const printDistributionReport = () => {
    if (adminOrders.length === 0) return alert('無訂單')
    
    const win = window.open('', '', 'width=800,height=600')
    win.document.write(`
      <html>
        <head>
          <title>發放明細表</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 10px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h2>餐點發放明細表 (Distribution List)</h2>
          <p>列印時間: ${new Date().toLocaleString()}</p>
          <table>
            <thead><tr><th>姓名</th><th>訂購內容</th><th>總金額</th></tr></thead>
            <tbody>
              ${adminOrders.map(order => {
                const details = typeof order.order_details === 'string' ? JSON.parse(order.order_details) : order.order_details
                const itemsStr = details.map(d => `${d.name} x${d.qty}`).join('<br/>')
                return `<tr>
                  <td>${order.customer_name}</td>
                  <td>${itemsStr}</td>
                  <td>$${order.total_price}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  if (loading) return <div style={{padding:'50px', textAlign:'center'}}>載入菜單中...</div>

  return (
    <div>
      {/* 右上角管理員按鈕 */}
      <button className="admin-badge-btn" onClick={handleAdminLogin}>
        {isAdminLoggedIn ? '登出管理員' : '管理員登入'}
      </button>

      <h1>🍔 朝日暖陽 線上點餐</h1>

      {/* 管理員專區 (登入後才顯示) */}
      {isAdminLoggedIn && (
        <div className="admin-dashboard">
          <div className="admin-header">
            <h3>🔧 管理員後台</h3>
            <div style={{fontSize:'0.9rem', color:'#666'}}>共 {adminOrders.length} 筆訂單</div>
          </div>
          
          <div className="report-section">
            <button className="report-btn vendor" onClick={printVendorReport}>列印店家總表</button>
            <button className="report-btn" onClick={printDistributionReport}>列印發放明細</button>
          </div>

          <div className="order-list">
            {adminOrders.map(order => {
              const details = typeof order.order_details === 'string' ? JSON.parse(order.order_details) : order.order_details
              return (
                <div key={order.id} className="admin-order-card">
                  <div className="order-header">
                    <span>{order.customer_name}</span>
                    <span>${order.total_price}</span>
                  </div>
                  <div>
                    {details.map((item, idx) => (
                      <div key={idx} className="order-item-row">
                        <span>{item.name} x {item.qty}</span>
                        <button className="delete-item-btn" onClick={() => deleteOrderItem(order, idx)}>刪除此項</button>
                      </div>
                    ))}
                  </div>
                  <button className="delete-order-btn" onClick={() => deleteOrder(order.id)}>刪除整筆訂單</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* --- 以下是一般使用者的點餐介面 --- */}
      
      {!isAdminLoggedIn && (
        <>
          <div className="user-input-section">
            <label className="input-label">LINE 群組名稱 / 您的暱稱：</label>
            <input 
              className="input-field"
              type="text" 
              placeholder="例如：設計部 - 小明" 
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="category-tabs">
            {categories.map(cat => (
              <button 
                key={cat} 
                className={`tab-btn ${activeTab === cat ? 'active' : ''}`}
                onClick={() => setActiveTab(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="menu-list">
            {currentItems.map(item => {
              const isDrink = item.category === '飲料' || item.name.includes('紅') || item.name.includes('綠') || item.name.includes('茶') || item.name.includes('奶') || item.name.includes('咖') || item.name.includes('飲')
              return (
                <div key={item.id} className="menu-item">
                  <div className="item-info">
                    <div className="item-name">{item.name}</div>
                    <div className="item-price">${item.price}</div>
                  </div>
                  <div className="item-actions">
                    {isDrink && (
                      <select className="temp-select-inline" value={drinkTemps[item.id] || '冰'} onChange={(e) => handleTempChange(item.id, e.target.value)}>
                        <option value="冰">冰</option><option value="去冰">去冰</option><option value="溫">溫</option><option value="熱">熱</option>
                      </select>
                    )}
                    <div className="qty-control">
                      <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>-</button>
                      <span className="qty-val">{cart[item.id] || 0}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {Object.keys(cart).length > 0 && (
            <div className="sticky-footer">
              <div className="total-price">總計: ${calculateTotal()}</div>
              <button className="review-btn" onClick={() => setIsReviewOpen(true)}>
                確認餐點 ({Object.values(cart).reduce((a,b)=>a+b, 0)})
              </button>
            </div>
          )}
        </>
      )}

      {/* 確認訂單 Modal */}
      {isReviewOpen && (
        <div className="modal-overlay" onClick={() => setIsReviewOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">確認訂單內容</div>
              <button className="close-btn" onClick={() => setIsReviewOpen(false)}>✕</button>
            </div>
            {getCartItemsDetails().map(item => (
              <div key={item.id} className="cart-item">
                <div style={{display:'flex',justifyContent:'space-between',fontWeight:'bold'}}>
                  <span>{item.finalName}</span>
                  <span>${item.price * item.qty}</span>
                </div>
                <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',marginTop:'10px'}}>
                  <div className="qty-control" style={{background:'white', border:'1px solid #ddd'}}>
                    <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>-</button>
                    <span className="qty-val">{item.qty}</span>
                    <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                  </div>
                </div>
              </div>
            ))}
            <div style={{textAlign:'right', fontSize:'1.2rem', fontWeight:'bold', marginTop:'20px', color:'#c2410c'}}>
              總金額: ${calculateTotal()}
            </div>
            <button className="submit-final-btn" disabled={submitting} onClick={submitOrder}>
              {submitting ? '送出中...' : '確認送出訂單'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App