// src/App.jsx - v21.0 (分離資料版)
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'
// 引入剛剛建立的資料檔
import { initialMenuData, UPGRADE_OPTIONS } from './data'

function App() {
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [cartItems, setCartItems] = useState([])
  
  const [name, setName] = useState('')
  const [activeTab, setActiveTab] = useState('')
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false)
  const [adminOrders, setAdminOrders] = useState([])

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  
  const [sauce, setSauce] = useState('')
  const [drinkType, setDrinkType] = useState('紅茶')
  const [temp, setTemp] = useState('冰')
  const [upgradeId, setUpgradeId] = useState('') 
  const [upgradeDrink, setUpgradeDrink] = useState('')

  useEffect(() => { fetchMenu() }, [])
  useEffect(() => { if (isAdminLoggedIn) fetchAdminOrders() }, [isAdminLoggedIn])

  async function fetchMenu() {
    try {
      const { data } = await supabase.from('menu_items').select('*').order('id')
      setMenu(data || [])
      if (data && data.length > 0) setActiveTab(data[0].category)
      setLoading(false)
    } catch (e) { console.error(e); setLoading(false); }
  }

  // 使用 import 進來的 initialMenuData
  const resetMenuData = async () => {
    if (!confirm('⚠️ 警告：重置將刪除舊菜單並載入新版！確定？')) return
    await supabase.from('menu_items').delete().neq('id', 0)
    const { error } = await supabase.from('menu_items').insert(initialMenuData)
    if (error) alert('失敗:'+error.message)
    else { alert('✅ 菜單重置成功！'); fetchMenu(); }
  }

  const cheapDrinks = menu.filter(m => m.category === '飲料' && m.price <= 25)
  const simpleDrinks = ['紅茶', '綠茶']

  const addToCart = (item) => {
    if (['早午餐拼盤', '套餐組合', '飲料', '漢堡系列', '鹹吐司系列', '貝果/可頌系列', '總匯吐司', '中式系列', '鐵板麵系列', '找飯找麵', '果醬系列'].includes(item.category)) {
      setSelectedItem(item)
      setSauce('胡麻')
      setTemp('冰')
      setUpgradeId('')
      
      const defaultDrink = cheapDrinks.length > 0 ? cheapDrinks[0].name : '紅茶 L';
      
      if (item.category === '早午餐拼盤') {
        setDrinkType('紅茶') 
      } else if (item.category === '套餐組合') {
        setDrinkType(defaultDrink) 
      } else if (item.category === '飲料') {
        setDrinkType('紅茶') 
      } else {
        setDrinkType('紅茶')
      }
      
      setUpgradeDrink(defaultDrink)
      setModalOpen(true)
    } else {
      addItemToCartList(item, item.name, item.price)
    }
  }

  const addItemToCartList = (item, finalName, finalPrice) => {
    const newItem = {
      id: Date.now(),
      originalId: item.id,
      name: finalName,
      price: finalPrice,
      qty: 1
    }
    setCartItems(prev => [...prev, newItem])
  }

  const confirmAddToCart = () => {
    if (!selectedItem) return
    let finalName = selectedItem.name
    let finalPrice = selectedItem.price

    if (selectedItem.category === '早午餐拼盤') {
      finalName += ` (${sauce}/${drinkType}/${temp})`
    }
    else if (selectedItem.category === '套餐組合') {
      // 格式: Name (Content) (Drink/Temp)
      finalName += ` (${drinkType}/${temp})`
    }
    else if (selectedItem.category === '飲料') {
      finalName += ` (${temp})`
    }
    else {
      if (upgradeId) {
        const upg = UPGRADE_OPTIONS.find(u => u.id === upgradeId)
        if (upg) {
          finalName += ` [升級: ${upg.name} (${upgradeDrink}/${temp})]`
          finalPrice += upg.price
        }
      }
    }

    addItemToCartList(selectedItem, finalName, finalPrice)
    setModalOpen(false)
  }

  const removeFromCart = (cartId) => {
    setCartItems(prev => prev.filter(item => item.id !== cartId))
  }

  const calculateTotal = () => cartItems.reduce((sum, item) => sum + item.price, 0)

  const submitOrder = async () => {
    if (!name.trim()) return alert('請輸入您的名稱！')
    if (cartItems.length === 0) return alert('購物車是空的')

    setSubmitting(true)
    const orderData = cartItems.map(item => ({
      name: item.name,
      price: item.price,
      qty: 1
    }))

    const { error } = await supabase.from('orders').insert({
      customer_name: name,
      order_details: orderData,
      total_price: calculateTotal()
    })

    if (error) {
      alert('送出失敗: ' + error.message)
    } else {
      alert('✅ 訂單已送出！')
      setCartItems([])
      setIsCartOpen(false)
      setName('')
    }
    setSubmitting(false)
  }

  const handleAdminLogin = () => {
    if (isAdminLoggedIn) return setIsAdminLoggedIn(false)
    if (prompt('請輸入管理員密碼：') === '1234') setIsAdminLoggedIn(true)
  }
  const fetchAdminOrders = async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    setAdminOrders(data || [])
  }
  const deleteOrder = async (id) => {
    if (confirm('確定刪除？')) {
      await supabase.from('orders').delete().eq('id', id)
      fetchAdminOrders()
    }
  }

  // --- 報表列印功能 (智慧拆單版) ---
  const printVendorReport = () => {
    if (adminOrders.length === 0) return alert('無訂單')
    
    const mainFoodSummary = {} 
    const drinkSummary = {}    
    const sideSummary = {}     
    let totalRevenue = 0
    
    const addCount = (dict, name, qty) => {
      if (!dict[name]) dict[name] = 0
      dict[name] += qty
    }

    adminOrders.forEach(order => {
      const details = Array.isArray(order.order_details) ? order.order_details : JSON.parse(order.order_details)
      details.forEach(item => {
        const qty = parseInt(item.qty) || 1
        totalRevenue += (item.price * qty)
        const name = item.name

        // 1. [升級套餐]：拆解為 主餐 / 副餐 / 飲料
        if (name.includes('[升級:')) {
          const match = name.match(/(.*?) \[升級: (.*?)\+25元飲品 \((.*?)\/(.*?)\)\]/)
          if (match) {
            addCount(mainFoodSummary, match[1].trim(), qty) 
            addCount(sideSummary, match[2].trim(), qty)     
            addCount(drinkSummary, `${match[3]} (${match[4]})`, qty) 
            return
          }
        } 
        
        // 2. [早午餐拼盤]：獨立統計主食 / 獨立統計飲料(含標籤)
        if (name.includes('拼盤') && (name.match(/\//g) || []).length >= 2) {
          const match = name.match(/(.*?) \((.*?)\/(.*?)\/(.*?)\)/)
          if (match) {
            addCount(mainFoodSummary, `${match[1]} (${match[2]})`, qty) 
            addCount(drinkSummary, `${match[3]} (拼盤) (${match[4]})`, qty)
            return
          }
        }

        // 3. [套餐組合]：主食綁定不拆 / 飲料拆出並合併
        if (['中式套餐','美式漢堡套餐','貝果套餐','元氣套餐'].some(k => name.startsWith(k)) && name.includes('(')) {
           // 找最後一個 ( 的位置
           const lastParenIndex = name.lastIndexOf('(')
           if (lastParenIndex !== -1 && name.endsWith(')')) {
             const drinkPart = name.substring(lastParenIndex + 1, name.length - 1)
             const mainPart = name.substring(0, lastParenIndex).trim()
             
             if (drinkPart.includes('/')) {
                const [dName, dTemp] = drinkPart.split('/')
                addCount(mainFoodSummary, mainPart, qty)
                addCount(drinkSummary, `${dName} (${dTemp})`, qty)
                return
             }
           }
        }

        // 4. [單點飲料]
        if (name.match(/\((冰|溫|熱)\)$/)) {
           addCount(drinkSummary, name, qty)
           return
        }

        // 5. [其他單點]
        if (['薯餅','薯條','雞塊','雞柳條','熱狗','蘿蔔糕','地瓜球','德式香腸','荷包蛋','細薯條','脆薯','黃金蘿蔔糕','檸檬雞柳條','炸物拼盤','薯鮮起司塔','炸雞三兄弟','生菜沙拉'].includes(name.trim())) {
             addCount(sideSummary, name, qty)
        } else {
             addCount(mainFoodSummary, name, qty)
        }
      })
    })

    const win = window.open('', '', 'width=800,height=600')
    const renderTable = (title, data) => {
      const keys = Object.keys(data).sort()
      if (keys.length === 0) return ''
      return `
        <h3>${title}</h3>
        <table>
          <thead><tr><th>品項</th><th>數量</th></tr></thead>
          <tbody>
            ${keys.map(k => `<tr><td>${k}</td><td style="font-weight:bold; font-size:1.2em">${data[k]}</td></tr>`).join('')}
          </tbody>
        </table>
      `
    }

    win.document.write(`
      <html>
        <head>
          <title>智慧分站製作單</title>
          <style>
            body { font-family: "Microsoft JhengHei", sans-serif; padding: 20px; }
            h2 { text-align: center; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 16px; }
            th, td { border: 1px solid #444; padding: 8px; text-align: left; }
            th { background-color: #eee; }
            .total { font-size: 1.5rem; font-weight: bold; text-align: right; border-top: 2px solid #000; padding-top: 10px;}
          </style>
        </head>
        <body>
          <h2>智慧分站製作單 (Station Report)</h2>
          <div style="text-align:center; margin-bottom:20px">${new Date().toLocaleString()}</div>
          
          ${renderTable('🥤 飲料吧台區 (Drinks Station)', drinkSummary)}
          ${renderTable('🍟 炸物/點心區 (Fried/Sides Station)', sideSummary)}
          ${renderTable('🍔 主餐製作區 (Main Kitchen)', mainFoodSummary)}
          
          <div class="total">預估總營業額: $${totalRevenue}</div>
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
            body { font-family: "Microsoft JhengHei", sans-serif; padding: 20px; }
            h2 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 10px; }
            tr:nth-child(even) { background-color: #fafafa; }
          </style>
        </head>
        <body>
          <h2>餐點發放明細表</h2>
          <table>
            <thead><tr><th>姓名</th><th>內容</th><th>金額</th></tr></thead>
            <tbody>
              ${adminOrders.map(order => {
                const details = Array.isArray(order.order_details) ? order.order_details : JSON.parse(order.order_details)
                return `<tr>
                  <td style="font-weight:bold">${order.customer_name}</td>
                  <td>${details.map(d => `<div>${d.name} x${d.qty}</div>`).join('')}</td>
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

  const currentItems = menu.filter(item => item.category === activeTab)
  const categories = [...new Set(menu.map(item => item.category))]

  return (
    <div>
      <button className="admin-badge-btn" onClick={handleAdminLogin}>{isAdminLoggedIn ? '登出' : '管理員'}</button>
      <h1>🍔 朝日暖陽 線上點餐</h1>

      {isAdminLoggedIn ? (
        <div className="admin-dashboard">
          <h3>管理員後台</h3>
          <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
             <button style={{flex:1, padding:'10px', background:'#0f766e', color:'white', border:'none', borderRadius:'8px', cursor:'pointer'}} onClick={printVendorReport}>📄 列印智慧製作單</button>
             <button style={{flex:1, padding:'10px', background:'#0ea5e9', color:'white', border:'none', borderRadius:'8px', cursor:'pointer'}} onClick={printDistributionReport}>📑 列印發放明細表</button>
          </div>
          {adminOrders.map(o => (
            <div key={o.id} style={{borderBottom:'1px solid #eee', padding:'10px'}}>
              <div style={{fontWeight:'bold'}}>{o.customer_name} - ${o.total_price}</div>
              <div style={{fontSize:'0.85rem', color:'#555'}}>
                {Array.isArray(o.order_details) ? o.order_details.map(d=>d.name).join(', ') : '格式舊'}
              </div>
              <button className="delete-order-btn" onClick={() => deleteOrder(o.id)}>刪除</button>
            </div>
          ))}
          <div className="danger-zone">
            <button className="reset-menu-btn" onClick={resetMenuData}>⚠️ 重置資料庫菜單 (載入新版邏輯)</button>
          </div>
        </div>
      ) : (
        <>
          <div className="user-input-section">
            <label className="input-label">LINE 群組名稱 / 您的暱稱：</label>
            <input className="input-field" type="text" placeholder="例如：設計部 - 小明" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="category-tabs">
            {categories.map(cat => (
              <button key={cat} className={`tab-btn ${activeTab === cat ? 'active' : ''}`} onClick={() => setActiveTab(cat)}>{cat}</button>
            ))}
          </div>

          <div className="menu-list">
            {currentItems.map(item => (
              <div key={item.id} className="menu-item">
                <div className="item-info">
                  <div className="item-name">{item.name}</div>
                  <div className="item-price">${item.price}</div>
                </div>
                <button className="add-btn" onClick={() => addToCart(item)}>+</button>
              </div>
            ))}
          </div>

          {cartItems.length > 0 && (
            <div className="sticky-footer">
              <div className="total-price">總計: ${calculateTotal()}</div>
              <button className="review-btn" onClick={() => setIsCartOpen(true)}>
                查看購物車 ({cartItems.length})
              </button>
            </div>
          )}
        </>
      )}

      {/* 選項視窗 (Modal) */}
      {modalOpen && selectedItem && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{selectedItem.name}</h3>
            
            {selectedItem.category === '早午餐拼盤' && (
              <>
                <div className="option-group">
                  <span className="option-title">1. 選擇醬料</span>
                  <div className="radio-group">
                    {['胡麻', '巴薩米克醋', '和風'].map(opt => (
                      <label key={opt} className={`radio-label ${sauce === opt ? 'selected' : ''}`}>
                        <input type="radio" className="radio-input" checked={sauce === opt} onChange={() => setSauce(opt)} />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="option-group">
                  <span className="option-title">2. 附餐飲料 (免費)</span>
                  <div className="radio-group">
                    {simpleDrinks.map(opt => (
                      <label key={opt} className={`radio-label ${drinkType === opt ? 'selected' : ''}`}>
                        <input type="radio" className="radio-input" checked={drinkType === opt} onChange={() => setDrinkType(opt)} />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="option-group">
                  <span className="option-title">3. 飲料溫度</span>
                  <div className="radio-group">
                    {['冰', '溫', '熱'].map(opt => (
                      <label key={opt} className={`radio-label ${temp === opt ? 'selected' : ''}`}>
                        <input type="radio" className="radio-input" checked={temp === opt} onChange={() => setTemp(opt)} />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {selectedItem.category === '套餐組合' && (
              <>
                <div className="option-group">
                  <span className="option-title">1. 選擇飲料 (已含$25)</span>
                  <select className="select-box" value={drinkType} onChange={e => setDrinkType(e.target.value)}>
                    {cheapDrinks.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div className="option-group">
                  <span className="option-title">2. 飲料溫度</span>
                  <div className="radio-group">
                    {['冰', '溫', '熱'].map(opt => (
                      <label key={opt} className={`radio-label ${temp === opt ? 'selected' : ''}`}>
                        <input type="radio" className="radio-input" checked={temp === opt} onChange={() => setTemp(opt)} />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {selectedItem.category === '飲料' && (
              <div className="option-group">
                <span className="option-title">飲料溫度</span>
                <div className="radio-group">
                  {['冰', '溫', '熱'].map(opt => (
                    <label key={opt} className={`radio-label ${temp === opt ? 'selected' : ''}`}>
                      <input type="radio" className="radio-input" checked={temp === opt} onChange={() => setTemp(opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {(!['早午餐拼盤', '套餐組合', '飲料'].includes(selectedItem.category)) && (
              <>
                 <div className="option-group">
                  <span className="option-title">想要升級套餐嗎？</span>
                  <select className="select-box" value={upgradeId} onChange={e => setUpgradeId(e.target.value)}>
                    <option value="">不用，我單點就好</option>
                    {UPGRADE_OPTIONS.map(u => (
                      <option key={u.id} value={u.id}>+${u.price} {u.name}</option>
                    ))}
                  </select>
                </div>
                
                {upgradeId && (
                  <>
                    <div className="option-group">
                      <span className="option-title">選擇套餐飲料 (折抵$25)</span>
                      <select className="select-box" value={upgradeDrink} onChange={e => setUpgradeDrink(e.target.value)}>
                        {cheapDrinks.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="option-group">
                      <span className="option-title">飲料溫度</span>
                      <div className="radio-group">
                        {['冰', '溫', '熱'].map(opt => (
                          <label key={opt} className={`radio-label ${temp === opt ? 'selected' : ''}`}>
                            <input type="radio" className="radio-input" checked={temp === opt} onChange={() => setTemp(opt)} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setModalOpen(false)}>取消</button>
              <button className="confirm-btn" onClick={confirmAddToCart}>確認加入購物車</button>
            </div>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="modal-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
              <h3>您的購物車</h3>
              <button style={{background:'none', border:'none', fontSize:'1.5rem', cursor:'pointer'}} onClick={() => setIsCartOpen(false)}>✕</button>
            </div>

            {cartItems.map(item => (
              <div key={item.id} className="cart-item">
                <div>
                  <div style={{fontWeight:'bold'}}>{item.name}</div>
                  <div className="cart-item-details">${item.price}</div>
                </div>
                <button className="remove-btn" onClick={() => removeFromCart(item.id)}>刪除</button>
              </div>
            ))}

            <div style={{textAlign:'right', fontSize:'1.2rem', fontWeight:'bold', marginTop:'20px', color:'#c2410c'}}>
              總金額: ${calculateTotal()}
            </div>
            <button style={{width:'100%', background:'#ea580c', color:'white', border:'none', padding:'15px', borderRadius:'12px', fontSize:'1.2rem', fontWeight:'bold', marginTop:'20px'}} disabled={submitting} onClick={submitOrder}>
              {submitting ? '送出中...' : '確認送出訂單'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App