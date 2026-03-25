import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { TrendingUp, TrendingDown, Package, IndianRupee, X, Calendar, User, MapPin, AlertTriangle, MessageSquare, Clock, Share2, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="card flex items-center gap-4">
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  </div>
);

function Dashboard({ currentUser }) {
  const [stats, setStats] = useState({
    totalAavakNetWt: 0,
    totalAavakAmount: 0,
    totalJavakNetWt: 0,
    totalJavakBags: 0,
    todayAavakWt: 0,
    todayJavakTrucks: 0,
    todayAavakAmount: 0,
  });
  const [itemBreakdown, setItemBreakdown] = useState({});
  const [rawData, setRawData] = useState({ aavak: [], javak: [] });
  const [selectedItem, setSelectedItem] = useState(null);
  const [bardanaStock, setBardanaStock] = useState(0);
  const [bardanaBreakdown, setBardanaBreakdown] = useState({});
  const [showAlert, setShowAlert] = useState(false);
  const [adminNotes, setAdminNotes] = useState([]);
  const [rateChart, setRateChart] = useState([]);
  
  // Out-turn Calculator State
  const [calcKapas, setCalcKapas] = useState('');
  const [outTurnResults, setOutTurnResults] = useState(null);

  useEffect(() => {
    const getLocalDate = () => {
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const localDate = new Date(now.getTime() - (offset * 60 * 1000));
      return localDate.toISOString().split('T')[0];
    };
    const today = getLocalDate();
    
    const unsubscribeNotes = onSnapshot(query(collection(db, 'adminNotes'), orderBy('timestamp', 'desc')), (snapshot) => {
      const allNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filteredNotes = allNotes.filter(note => {
        if (note.assignedTo === 'ALL' || !note.assignedTo) return true;
        if (currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN') return true;
        return note.assignedTo === currentUser?.employeeId;
      });
      setAdminNotes(filteredNotes);
    });

    const unsubscribeRates = onSnapshot(query(collection(db, 'rateChart'), orderBy('timestamp', 'desc')), (snapshot) => {
      setRateChart(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeBardana = onSnapshot(collection(db, 'bardanaEntries'), (snapshot) => {
      let totalGunny = 0;
      const breakdown = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const item = data.itemName?.toUpperCase() || 'UNKNOWN';
        const qty = parseInt(data.quantity || 0, 10);
        
        if (data.type === 'IN') {
          breakdown[item] = (breakdown[item] || 0) + qty;
        } else {
          breakdown[item] = (breakdown[item] || 0) - qty;
        }

        if (item === 'GUNNY BAGS' || item === 'GUNNY BAG' || item === 'BARDANA') {
          totalGunny += qty * (data.type === 'IN' ? 1 : -1);
        }
      });
      setBardanaStock(totalGunny);
      setBardanaBreakdown(breakdown);
      
      if (totalGunny < 100) {
        setShowAlert(true);
      } else {
        setShowAlert(false);
      }
    });

    const unsubscribeAavak = onSnapshot(collection(db, 'cottonEntries'), (snapshot) => {
      const aavakData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const unsubscribeJavak = onSnapshot(collection(db, 'javakEntries'), (javakSnapshot) => {
        const javakData = javakSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        let totalAavakWt = 0;
        let totalAavakAmt = 0;
        let totalJavakWt = 0;
        let totalJavakBags = 0;
        let todayAavakWt = 0;
        let todayJavakTrucks = 0;
        let todayAavakAmt = 0;
        const breakdown = {};

        aavakData.forEach(data => {
          const weight = parseFloat(data.netWt || 0);
          const item = data.itemName || 'Uncategorized';
          const amt = parseFloat(data.amountPaid || 0);
          totalAavakWt += weight;
          totalAavakAmt += amt;
          
          if (data.billingDate === today) {
            todayAavakWt += weight;
            todayAavakAmt += amt;
          }

          if (breakdown[item]) {
            breakdown[item] += weight;
          } else {
            breakdown[item] = weight;
          }
        });

        javakData.forEach(data => {
          const weight = parseFloat(data.netWt || 0);
          const item = data.commodity || 'Uncategorized';
          totalJavakWt += weight;
          totalJavakBags += parseInt(data.numberOfBags || 0, 10);
          
          if (data.date === today) {
            todayJavakTrucks += 1;
          }

          if (breakdown[item]) {
            breakdown[item] -= weight;
          } else {
            breakdown[item] = -weight;
          }
        });

        setStats({
          totalAavakNetWt: totalAavakWt,
          totalAavakAmount: totalAavakAmt,
          totalJavakNetWt: totalJavakWt,
          totalJavakBags: totalJavakBags,
          todayAavakWt,
          todayJavakTrucks,
          todayAavakAmount: todayAavakAmt
        });
        setItemBreakdown(breakdown);
        setRawData({ aavak: aavakData, javak: javakData });
      });

      return () => unsubscribeJavak();
    });

    return () => {
      unsubscribeAavak();
      unsubscribeBardana();
      unsubscribeNotes();
      unsubscribeRates();
    };
  }, [currentUser?.employeeId, currentUser?.role]);

  const handleShareSummary = () => {
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    const aavakQuintals = (stats.todayAavakWt / 100).toFixed(1);
    const summaryText = `*VCC COTTON SUMMARY - ${today.toUpperCase()}*\n\n` +
      `📥 *AAVAK:* ${aavakQuintals} QNTL\n` +
      `🚚 *DISPATCH:* ${stats.todayJavakTrucks} TRUCKS\n` +
      `💰 *TODAY'S PAYOUT:* ₹${stats.todayAavakAmount.toLocaleString()}\n\n` +
      `_Generated via VCC Cotton App_`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopySummary = () => {
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    const aavakQuintals = (stats.todayAavakWt / 100).toFixed(1);
    const summaryText = `*VCC COTTON SUMMARY - ${today.toUpperCase()}*\n\n` +
      `📥 *AAVAK:* ${aavakQuintals} QNTL\n` +
      `🚚 *DISPATCH:* ${stats.todayJavakTrucks} TRUCKS\n` +
      `💰 *TODAY'S PAYOUT:* ₹${stats.todayAavakAmount.toLocaleString()}\n\n` +
      `_Generated via VCC Cotton App_`;
    
    navigator.clipboard.writeText(summaryText).then(() => {
      alert('Summary copied to clipboard!');
    });
  };

  const copyOutTurnToClipboard = () => {
    if (!outTurnResults) return;
    const text = `*VCC OUT-TURN ESTIMATE*\n` +
      `Kapas: ${calcKapas} kg\n` +
      `Lint: ${outTurnResults.lint} kg\n` +
      `Seed: ${outTurnResults.seed} kg\n` +
      `Bales: ~${outTurnResults.bales}`;
    
    navigator.clipboard.writeText(text).then(() => {
      alert('Results copied to clipboard!');
    });
  };

  const calculateOutTurn = (val) => {
    const kapas = parseFloat(val);
    if (isNaN(kapas) || kapas <= 0) {
      setOutTurnResults(null);
      return;
    }
    // Standard Out-turn Ratios (Approximate)
    // Lint (Bales): ~34%
    // Seed: ~63%
    // Trash/Loss: ~3%
    const lint = kapas * 0.34;
    const seed = kapas * 0.63;
    const bales = lint / 170; // 1 Bale = 170kg approx
    
    setOutTurnResults({
      lint: lint.toFixed(2),
      seed: seed.toFixed(2),
      bales: bales.toFixed(1)
    });
  };

  const getFilteredDetails = (itemName) => {
    const aavakDetails = rawData.aavak.filter(d => (d.itemName || 'Uncategorized') === itemName);
    const javakDetails = rawData.javak.filter(d => (d.commodity || 'Uncategorized') === itemName);
    return { aavakDetails, javakDetails };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Dashboard Overview</h2>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleCopySummary}
            className="btn-secondary flex items-center gap-2 whitespace-nowrap uppercase tracking-widest text-xs py-3"
          >
            <Share2 className="w-4 h-4" /> Copy Summary
          </button>
          <button 
            onClick={handleShareSummary}
            className="btn-primary flex items-center gap-2 whitespace-nowrap uppercase tracking-widest text-xs py-3"
          >
            <Share2 className="w-4 h-4" /> Share WhatsApp
          </button>
        </div>
      </div>
      
      {/* Today's Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">Today's Aavak</p>
          <p className="text-3xl font-black">{(stats.todayAavakWt / 100).toFixed(1)} <span className="text-sm font-bold opacity-60">QNTL</span></p>
        </div>
        <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200 dark:shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">Today's Payout</p>
          <p className="text-3xl font-black">₹{stats.todayAavakAmount.toLocaleString()}</p>
        </div>
        <div className="bg-orange-600 rounded-2xl p-6 text-white shadow-lg shadow-orange-200 dark:shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">Today's Dispatch</p>
          <p className="text-3xl font-black">{stats.todayJavakTrucks} <span className="text-sm font-bold opacity-60">TRUCKS</span></p>
        </div>
      </div>
      
      {/* Bardana Alert Modal */}
      <AnimatePresence>
        {showAlert && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 50 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-4 border-red-500"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <AlertTriangle className="w-12 h-12 text-red-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Stock Warning!</h3>
                  <p className="text-slate-600 font-medium">
                    Bardana stock is dangerously low!
                  </p>
                </div>
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                  <p className="text-sm text-red-600 font-bold uppercase tracking-widest mb-1">Bardana Stock</p>
                  <p className="text-5xl font-black text-red-700">{bardanaStock}</p>
                  <p className="text-xs text-red-400 mt-2 font-semibold italic">Minimum required: 100 Bags</p>
                </div>
                <button 
                  onClick={() => setShowAlert(false)}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-200 active:scale-95 text-lg uppercase tracking-widest"
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Incoming (Net Wt)" 
          value={`${stats.totalAavakNetWt.toLocaleString()} kg`} 
          icon={TrendingUp} 
          color="bg-emerald-500"
        />
        <StatCard 
          title="Amount Paid" 
          value={`₹${stats.totalAavakAmount.toLocaleString()}`} 
          icon={IndianRupee} 
          color="bg-indigo-500"
        />
        <StatCard 
          title="Total Outgoing (Net Wt)" 
          value={`${stats.totalJavakNetWt.toLocaleString()} kg`} 
          icon={TrendingDown} 
          color="bg-orange-500"
        />
        <StatCard 
          title="Total Outgoing Bags" 
          value={stats.totalJavakBags.toLocaleString()} 
          icon={Package} 
          color="bg-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rate Chart Section */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold">Current Rate Chart</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rateChart.length > 0 ? (
              rateChart.map(rate => (
                <div key={rate.id} className="flex justify-between items-center p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <span className="font-bold text-slate-700 uppercase text-xs tracking-wider">{rate.itemName}</span>
                  <span className="font-black text-emerald-700">₹{rate.rate}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-sm italic col-span-2 text-center py-4">No rates published yet</p>
            )}
          </div>
        </div>

        {/* Admin Notes Section */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold">Admin Announcements</h3>
          </div>
          <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
            {adminNotes.length > 0 ? (
              adminNotes.map(note => (
                <div key={note.id} className="p-3 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-lg">
                  <p className="text-sm font-bold text-slate-800 uppercase leading-relaxed">{note.content}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-bold uppercase">
                    <Clock className="w-3 h-3" />
                    {note.timestamp?.toDate().toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-sm italic text-center py-4">No recent announcements</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Bardana Stock</h3>
          <div className="space-y-3">
            {Object.entries(bardanaBreakdown).length > 0 ? (
              Object.entries(bardanaBreakdown)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([item, qty]) => (
                <div 
                  key={item} 
                  className="flex justify-between items-center p-3 border border-slate-100 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${qty < 100 ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                    <span className="font-medium text-slate-700">{item}</span>
                  </div>
                  <span className={`font-bold ${qty < 100 ? 'text-red-600' : 'text-slate-900'}`}>
                    {qty.toLocaleString()} Bags
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-sm italic py-4 text-center">No Bardana data</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Current Stock by Item</h3>
          <div className="space-y-3">
            {Object.entries(itemBreakdown).length > 0 ? (
              Object.entries(itemBreakdown)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([item, weight]) => (
                <div 
                  key={item} 
                  onClick={() => setSelectedItem(item)}
                  className="flex justify-between items-center p-3 border border-slate-100 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${weight < 0 ? 'bg-red-500' : 'bg-indigo-500'}`}></div>
                    <span className="font-medium text-slate-700 group-hover:text-indigo-700">{item}</span>
                  </div>
                  <span className={`font-bold ${weight < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {weight.toLocaleString()} kg
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-sm italic py-4 text-center">No data available</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Stock Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600">Current Stock (Net Wt)</span>
              <span className="font-bold text-lg text-indigo-600">
                {(stats.totalAavakNetWt - stats.totalJavakNetWt).toLocaleString()} kg
              </span>
            </div>
            <p className="text-xs text-slate-400 italic">
              * Stock calculation is based on total incoming minus total outgoing net weight.
            </p>
          </div>
        </div>

        {/* Out-turn Ratio Calculator */}
        <div className="card bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-none">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5" />
            <h3 className="text-lg font-bold uppercase tracking-tight">Out-turn Calculator</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-70">Raw Kapas (KG)</label>
              <input 
                type="number" 
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-bold"
                placeholder="Enter weight..."
                value={calcKapas}
                onChange={(e) => {
                  setCalcKapas(e.target.value);
                  calculateOutTurn(e.target.value);
                }}
              />
            </div>
            
            {outTurnResults && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/10 p-2 rounded-lg text-center">
                    <p className="text-[8px] font-bold uppercase opacity-70">Lint</p>
                    <p className="text-sm font-black">{outTurnResults.lint} kg</p>
                  </div>
                  <div className="bg-white/10 p-2 rounded-lg text-center">
                    <p className="text-[8px] font-bold uppercase opacity-70">Seed</p>
                    <p className="text-sm font-black">{outTurnResults.seed} kg</p>
                  </div>
                  <div className="bg-white/10 p-2 rounded-lg text-center">
                    <p className="text-[8px] font-bold uppercase opacity-70">Bales</p>
                    <p className="text-sm font-black">~{outTurnResults.bales}</p>
                  </div>
                </div>
                <button 
                  onClick={copyOutTurnToClipboard}
                  className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  Copy Results
                </button>
              </div>
            )}
            <p className="text-[9px] opacity-50 italic">
              * Based on standard 34% Lint and 63% Seed yield ratios.
            </p>
          </div>
        </div>
      </div>

      {/* Item Details Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedItem}</h3>
                  <p className="text-sm text-slate-500">Transaction History</p>
                </div>
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Aavak Column */}
                <div className="space-y-4">
                  <h4 className="font-bold text-emerald-600 flex items-center gap-2 border-b border-emerald-100 pb-2">
                    <TrendingUp className="w-4 h-4" /> Aavak (Incoming)
                  </h4>
                  <div className="space-y-3">
                    {getFilteredDetails(selectedItem).aavakDetails.length > 0 ? (
                      getFilteredDetails(selectedItem).aavakDetails.map(d => (
                        <div key={d.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-slate-400 font-mono">#{d.tokenNo}</span>
                            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {d.billingDate}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-900 font-medium">
                            <User className="w-3 h-3 text-slate-400" /> {d.Name}
                          </div>
                          <div className="text-right font-bold text-indigo-600 text-sm">
                            {d.netWt} kg
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-sm italic">No incoming entries</p>
                    )}
                  </div>
                </div>

                {/* Javak Column */}
                <div className="space-y-4">
                  <h4 className="font-bold text-orange-600 flex items-center gap-2 border-b border-orange-100 pb-2">
                    <TrendingDown className="w-4 h-4" /> Javak (Outgoing)
                  </h4>
                  <div className="space-y-3">
                    {getFilteredDetails(selectedItem).javakDetails.length > 0 ? (
                      getFilteredDetails(selectedItem).javakDetails.map(d => (
                        <div key={d.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-slate-400 font-mono">#{d.gatePassNo}</span>
                            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {d.date}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-900 font-medium">
                            <MapPin className="w-3 h-3 text-slate-400" /> {d.destination}
                          </div>
                          <div className="text-right font-bold text-orange-600 text-sm">
                            {d.netWt} kg
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-sm italic">No outgoing entries</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Dashboard;
