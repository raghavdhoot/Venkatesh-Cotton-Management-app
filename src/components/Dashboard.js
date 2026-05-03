import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { TrendingUp, TrendingDown, Package, IndianRupee, X, Calendar, User, MapPin, AlertTriangle, Clock, Share2, Calculator, CheckSquare, MessageSquare, Send, Bell } from 'lucide-react';
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
  const [cashBalance, setCashBalance] = useState(0);
  const [itemBreakdown, setItemBreakdown] = useState({});
  const [rawData, setRawData] = useState({ aavak: [], javak: [] });
  const [selectedItem, setSelectedItem] = useState(null);
  const [bardanaStock, setBardanaStock] = useState(0);
  const [bardanaBreakdown, setBardanaBreakdown] = useState({});
  const [showAlert, setShowAlert] = useState(false);
  const [adminNotes, setAdminNotes] = useState([]);
  const [adminTasks, setAdminTasks] = useState([]);
  const [rateChart, setRateChart] = useState([]);
  const [myMessages, setMyMessages] = useState([]);
  const [employeeMessage, setEmployeeMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messageStatus, setMessageStatus] = useState({ text: '', type: '' });
  
  // Custom Period Summary State
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
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
      setAdminNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeTasks = onSnapshot(query(collection(db, 'adminTasks'), orderBy('timestamp', 'desc')), (snapshot) => {
      const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const myTasks = allTasks.filter(task => {
        if (currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN') return true;
        return task.assignedTo === currentUser?.employeeId;
      });
      setAdminTasks(myTasks);
    });

    const unsubscribeRates = onSnapshot(query(collection(db, 'rateChart'), orderBy('timestamp', 'desc')), (snapshot) => {
      setRateChart(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeMyMessages = onSnapshot(query(collection(db, 'employeeMessages'), orderBy('timestamp', 'desc')), (snapshot) => {
      const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = allMsgs.filter(msg => msg.senderId === currentUser?.employeeId);
      setMyMessages(filtered);
    });

    const unsubscribeCash = onSnapshot(collection(db, 'cashTransactions'), (snapshot) => {
      let totalIn = 0;
      let totalOut = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.type === 'IN') totalIn += data.amount;
        else totalOut += data.amount;
      });
      setCashBalance(totalIn - totalOut);
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
      unsubscribeTasks();
      unsubscribeRates();
      unsubscribeMyMessages();
      unsubscribeCash();
    };
  }, [currentUser?.employeeId, currentUser?.role]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!employeeMessage.trim() || !currentUser) return;
    
    setIsSending(true);
    try {
      await addDoc(collection(db, 'employeeMessages'), {
        content: employeeMessage.toUpperCase(),
        senderName: currentUser.name,
        senderId: currentUser.employeeId,
        timestamp: serverTimestamp()
      });
      setEmployeeMessage('');
      setMessageStatus({ text: 'Message sent to Admin!', type: 'success' });
      setTimeout(() => setMessageStatus({ text: '', type: '' }), 3000);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageStatus({ text: 'Failed to send message', type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

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
        setMessageStatus({ text: 'Summary copied!', type: 'success' });
        setTimeout(() => setMessageStatus({ text: '', type: '' }), 3000);
    });
  };

  const getCustomPeriodStats = () => {
    if (!startDate || !endDate) return null;
    
    let totalAavakWt = 0;
    let totalAavakAmt = 0;
    let totalJavakTrucks = 0;
    
    rawData.aavak.forEach(data => {
      if (data.billingDate >= startDate && data.billingDate <= endDate) {
        totalAavakWt += parseFloat(data.netWt || 0);
        totalAavakAmt += parseFloat(data.amountPaid || 0);
      }
    });
    
    rawData.javak.forEach(data => {
      if (data.date >= startDate && data.date <= endDate) {
        totalJavakTrucks += 1;
      }
    });
    
    return {
      aavakWt: (totalAavakWt / 100).toFixed(1),
      aavakAmt: totalAavakAmt.toLocaleString(),
      javakTrucks: totalJavakTrucks
    };
  };

  const handleSharePeriodSummary = () => {
    const periodStats = getCustomPeriodStats();
    if (!periodStats) return;

    const start = new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const end = new Date(endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    
    const summaryText = `*VCC COTTON SUMMARY*\n*PERIOD:* ${start.toUpperCase()} TO ${end.toUpperCase()}\n\n` +
      `📥 *AAVAK:* ${periodStats.aavakWt} QNTL\n` +
      `🚚 *DISPATCH:* ${periodStats.javakTrucks} TRUCKS\n` +
      `💰 *TOTAL PAYOUT:* ₹${periodStats.aavakAmt}\n\n` +
      `_Generated via VCC Cotton App_`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyPeriodSummary = () => {
    const periodStats = getCustomPeriodStats();
    if (!periodStats) return;

    const start = new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const end = new Date(endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    
    const summaryText = `*VCC COTTON SUMMARY*\n*PERIOD:* ${start.toUpperCase()} TO ${end.toUpperCase()}\n\n` +
      `📥 *AAVAK:* ${periodStats.aavakWt} QNTL\n` +
      `🚚 *DISPATCH:* ${periodStats.javakTrucks} TRUCKS\n` +
      `💰 *TOTAL PAYOUT:* ₹${periodStats.aavakAmt}\n\n` +
      `_Generated via VCC Cotton App_`;
    
    navigator.clipboard.writeText(summaryText).then(() => {
      alert('Period summary copied!');
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
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setIsPeriodModalOpen(true)}
            className="btn-secondary flex items-center gap-2 whitespace-nowrap uppercase tracking-widest text-xs py-3"
          >
            <Calendar className="w-4 h-4" /> Period Summary
          </button>
          <button 
            onClick={handleCopySummary}
            className="btn-secondary flex items-center gap-2 whitespace-nowrap uppercase tracking-widest text-xs py-3"
          >
            <Share2 className="w-4 h-4" /> Copy Today
          </button>
          <button 
            onClick={handleShareSummary}
            className="btn-primary flex items-center gap-2 whitespace-nowrap uppercase tracking-widest text-xs py-3"
          >
            <Share2 className="w-4 h-4" /> Share WhatsApp
          </button>
        </div>
      </div>
      
      {/* Period Summary Modal */}
      <AnimatePresence>
        {isPeriodModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase">Custom Period Summary</h3>
                <button onClick={() => setIsPeriodModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">From Date</label>
                    <input 
                      type="date" 
                      className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">To Date</label>
                    <input 
                      type="date" 
                      className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {startDate && endDate && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                        <span className="text-slate-500 text-sm font-medium">📥 Total Aavak</span>
                        <span className="font-bold text-indigo-600">{getCustomPeriodStats()?.aavakWt} QNTL</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                        <span className="text-slate-500 text-sm font-medium">🚚 Total Dispatch</span>
                        <span className="font-bold text-orange-600">{getCustomPeriodStats()?.javakTrucks} TRUCKS</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-sm font-medium">💰 Total Payout</span>
                        <span className="font-bold text-emerald-600">₹{getCustomPeriodStats()?.aavakAmt}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button 
                    onClick={handleCopyPeriodSummary}
                    disabled={!startDate || !endDate}
                    className="btn-secondary py-3 text-xs flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" /> Copy Text
                  </button>
                  <button 
                    onClick={handleSharePeriodSummary}
                    disabled={!startDate || !endDate}
                    className="btn-primary py-3 text-xs flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" /> Share WA
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Today's Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        {(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN' || currentUser?.role?.toUpperCase() === 'CASHIER') && (
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg shadow-slate-200 dark:shadow-none">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">Cash Balance</p>
            <p className="text-3xl font-black">₹{cashBalance.toLocaleString()}</p>
          </div>
        )}
      </div>
      
      {/* Bardana Alert Modal */}
      <AnimatePresence>
        {showAlert && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 50 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-4 border-red-500"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Stock Warning!</h3>
                  <p className="text-slate-600 dark:text-slate-400 font-medium">
                    Bardana stock is dangerously low!
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-100 dark:border-red-800/50">
                  <p className="text-sm text-red-600 dark:text-red-400 font-bold uppercase tracking-widest mb-1">Bardana Stock</p>
                  <p className="text-5xl font-black text-red-700 dark:text-red-500">{bardanaStock}</p>
                  <p className="text-xs text-red-400 dark:text-red-500/60 mt-2 font-semibold italic">Minimum required: 100 Bags</p>
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
        {/* Dashboard Notes Section */}
        <div className="card !p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">Dashboard Notes</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[250px] overflow-y-auto">
            {adminNotes.length > 0 ? (
              adminNotes.map(note => (
                <div key={note.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase leading-relaxed">{note.content}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                    <Clock className="w-3 h-3" />
                    {note.timestamp?.toDate().toLocaleString()} • BY {note.author}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm italic text-center py-8">No public notes at this time</p>
            )}
          </div>
        </div>

        {/* Assigned Tasks Section */}
        <div className="card !p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">My Private Tasks</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[250px] overflow-y-auto">
            {adminTasks.length > 0 ? (
              adminTasks.map(task => (
                <div key={task.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-l-4 border-amber-500">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase leading-relaxed">{task.content}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                    <Clock className="w-3 h-3" />
                    {task.timestamp?.toDate().toLocaleString()} • FROM ADMIN
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm italic text-center py-8">No private tasks assigned to you</p>
            )}
          </div>
        </div>

        {/* Rate Chart Section */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold uppercase tracking-tight">Current Rate Chart</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rateChart.length > 0 ? (
              rateChart.map(rate => (
                <div key={rate.id} className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl">
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">{rate.itemName}</span>
                  <span className="font-black text-emerald-700 dark:text-emerald-400">₹{rate.rate}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm italic col-span-2 text-center py-4">No rates published yet</p>
            )}
          </div>
        </div>

        {/* Message Admin Section */}
        <div className="card space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Message Admin</h3>
            </div>
            <form onSubmit={handleSendMessage} className="space-y-3">
              <textarea 
                className="input-field min-h-[80px] text-sm uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                placeholder="SEND A NOTE OR REPORT TO ADMIN..."
                value={employeeMessage}
                onChange={(e) => setEmployeeMessage(e.target.value.toUpperCase())}
                required
              />
              <div className="flex items-center justify-between gap-2">
                {messageStatus.text && (
                  <span className={`text-[10px] font-bold ${messageStatus.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {messageStatus.text}
                  </span>
                )}
                <button 
                  type="submit" 
                  disabled={isSending}
                  className="btn-primary py-2 px-4 text-xs flex items-center gap-2 ml-auto"
                >
                  {isSending ? 'Sending...' : <><Send className="w-3 h-3" /> Send</>}
                </button>
              </div>
            </form>
          </div>

          {myMessages.length > 0 && (
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">My Recent Messages</h4>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {myMessages.map(msg => (
                  <div key={msg.id} className="space-y-2">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{msg.content}</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 uppercase">
                        {msg.timestamp?.toDate().toLocaleString()}
                      </p>
                    </div>
                    {msg.reply && (
                      <div className="ml-6 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl relative">
                        <div className="absolute -left-3 top-4 w-3 h-px bg-indigo-200 dark:bg-indigo-800"></div>
                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Admin Reply:
                        </p>
                        <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{msg.reply}</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 uppercase">
                          {msg.replyTimestamp?.toDate().toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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
                  className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${qty < 100 ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item}</span>
                  </div>
                  <span className={`font-bold ${qty < 100 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
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
                  className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${weight < 0 ? 'bg-red-500' : 'bg-indigo-500'}`}></div>
                    <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">{item}</span>
                  </div>
                  <span className={`font-bold ${weight < 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
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
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-slate-600 dark:text-slate-400">Current Stock (Net Wt)</span>
              <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
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
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedItem}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Transaction History</p>
                </div>
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Aavak Column */}
                <div className="space-y-4">
                  <h4 className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 border-b border-emerald-100 dark:border-emerald-900/30 pb-2">
                    <TrendingUp className="w-4 h-4" /> Aavak (Incoming)
                  </h4>
                  <div className="space-y-3">
                    {getFilteredDetails(selectedItem).aavakDetails.length > 0 ? (
                      getFilteredDetails(selectedItem).aavakDetails.map(d => (
                        <div key={d.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">#{d.tokenNo}</span>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {d.billingDate}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-medium">
                            <User className="w-3 h-3 text-slate-400 dark:text-slate-500" /> {d.Name}
                          </div>
                          <div className="text-right font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                            {d.netWt} kg
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 dark:text-slate-500 text-sm italic">No incoming entries</p>
                    )}
                  </div>
                </div>

                {/* Javak Column */}
                <div className="space-y-4">
                  <h4 className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2 border-b border-orange-100 dark:border-orange-900/30 pb-2">
                    <TrendingDown className="w-4 h-4" /> Javak (Outgoing)
                  </h4>
                  <div className="space-y-3">
                    {getFilteredDetails(selectedItem).javakDetails.length > 0 ? (
                      getFilteredDetails(selectedItem).javakDetails.map(d => (
                        <div key={d.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">#{d.gatePassNo}</span>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {d.date}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-medium">
                            <MapPin className="w-3 h-3 text-slate-400 dark:text-slate-500" /> {d.destination}
                          </div>
                          <div className="text-right font-bold text-orange-600 dark:text-orange-400 text-sm">
                            {d.netWt} kg
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 dark:text-slate-500 text-sm italic">No outgoing entries</p>
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
