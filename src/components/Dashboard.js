import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { TrendingUp, TrendingDown, Package, IndianRupee, X, Calendar, User, MapPin, AlertTriangle, Clock, Share2, Calculator, CheckSquare, MessageSquare, Send, Bell, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// Serial No. 3: jsPDF + autoTable for EOD Report generation
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
  const [maturedEntries, setMaturedEntries] = useState([]);
  const todayStr = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    const getLocalDate = () => {
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const localDate = new Date(now.getTime() - (offset * 60 * 1000));
      return localDate.toISOString().split('T')[0];
    };
    const today = getLocalDate();
    const maturityQuery = query(
      collection(db, 'cottonEntries'),
      where('paymentDueDate', '==', todayStr)
    );
    const unsubscribeMaturity = onSnapshot(maturityQuery, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMaturedEntries(entries);
    }, (error) => {
      console.error("Maturity forecast query error: ", error);
    });
    
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

    const unsubscribeRates = onSnapshot(query(collection(db, 'rateCharts'), orderBy('timestamp', 'desc')), (snapshot) => {
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

    const unsubscribeBardana = onSnapshot(collection(db, 'bardana'), (snapshot) => {
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
      unsubscribeMaturity();
    };
  }, [currentUser?.employeeId, currentUser?.role, todayStr]);

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

  const generateEODReport = () => {
    try {
      const today = new Date();
      const todayStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const dateLabel = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const timeLabel = today.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      const todayAavak = rawData.aavak.filter(e => e.billingDate === todayStr);
      const todayJavak = rawData.javak.filter(e => (e.date || e.billingDate || '') === todayStr);

      // Totals
      const totalWeight  = todayAavak.reduce((s, e) => s + parseFloat(e.netWt || 0), 0);
      const totalAmount  = todayAavak.reduce((s, e) => s + parseFloat(e.netAmount || 0), 0);
      const totalPaid    = todayAavak.reduce((s, e) => s + parseFloat(e.amountPaid || 0), 0);
      const totalPending = totalAmount - totalPaid;

      const doc = new jsPDF();
      const W = doc.internal.pageSize.width;

      // ── Header ──────────────────────────────────────────────────────────────
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, W, 38, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(17);
      doc.setFont('Helvetica', 'bold');
      doc.text('VENKATESH COTTON CO.', 14, 14);

      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.text('END OF DAY REPORT', 14, 22);
      doc.text(`Date: ${dateLabel}   |   Time: ${timeLabel}   |   By: ${(currentUser?.name || 'ADMIN').toUpperCase()}`, 14, 30);

      // ── Summary Cards ────────────────────────────────────────────────────────
      const cards = [
        { label: 'Total Pattis',    value: String(todayAavak.length) },
        { label: 'Net Weight',      value: `${totalWeight.toLocaleString('en-IN')} kg` },
        { label: 'Gross Amount',    value: `Rs ${totalAmount.toLocaleString('en-IN')}` },
        { label: 'Amount Paid',     value: `Rs ${totalPaid.toLocaleString('en-IN')}` },
        { label: 'Pending Amount',  value: `Rs ${totalPending.toLocaleString('en-IN')}` },
        { label: 'Dispatches',      value: String(todayJavak.length) },
      ];

      const cardW = (W - 28) / 3;
      const cardH = 20;
      let cx = 14, cy = 44;
      cards.forEach((card, i) => {
        if (i === 3) { cx = 14; cy += cardH + 3; }
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(cx, cy, cardW - 2, cardH, 2, 2, 'FD');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.setFont('Helvetica', 'normal');
        doc.text(card.label.toUpperCase(), cx + 3, cy + 6);
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.setFont('Helvetica', 'bold');
        doc.text(card.value, cx + 3, cy + 15);
        cx += cardW + 1;
      });

      // ── Aavak Table ──────────────────────────────────────────────────────────
      const tableStartY = cy + cardH + 8;
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('AAVAK — Incoming Entries', 14, tableStartY);

      doc.autoTable({
        startY: tableStartY + 4,
        head: [['Token', 'Farmer Name', 'Item', 'Net Wt (kg)', 'Amount (Rs)', 'Paid (Rs)', 'Pending (Rs)', 'Mode']],
        body: todayAavak.length > 0
          ? todayAavak.map(e => {
              const amt     = parseFloat(e.netAmount || 0);
              const paid    = parseFloat(e.amountPaid || 0);
              return [
                e.tokenNo || '-',
                (e.Name || e.farmerName || 'N/A').toUpperCase(),
                (e.itemName || '-').toUpperCase(),
                parseFloat(e.netWt || 0).toLocaleString('en-IN'),
                amt.toLocaleString('en-IN'),
                paid.toLocaleString('en-IN'),
                (amt - paid).toLocaleString('en-IN'),
                (e.paymentMode || 'CASH').toUpperCase(),
              ];
            })
          : [['—', 'No entries for today', '', '', '', '', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' },
        },
      });

      // ── Javak Table ───────────────────────────────────────────────────────────
      const javakY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('JAVAK — Outgoing Dispatches', 14, javakY);

      doc.autoTable({
        startY: javakY + 4,
        head: [['Gate Pass', 'Vehicle No', 'Commodity', 'Destination', 'Bags', 'Net Wt (kg)']],
        body: todayJavak.length > 0
          ? todayJavak.map(e => [
              e.gatePassNo || '-',
              (e.vehicleNumber || e.vehicleNo || '-').toUpperCase(),
              (e.commodity || '-').toUpperCase(),
              (e.destination || '-').toUpperCase(),
              parseInt(e.numberOfBags || e.bags || 0, 10).toLocaleString('en-IN'),
              parseFloat(e.netWt || 0).toLocaleString('en-IN'),
            ])
          : [['—', 'No dispatches today', '', '', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        columnStyles: {
          4: { halign: 'right' },
          5: { halign: 'right' },
        },
      });

      // ── Footer on every page ──────────────────────────────────────────────────
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setFont('Helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Venkatesh Cotton Co. • EOD Report • ${dateLabel} • Page ${i} of ${pages}`,
          W / 2, doc.internal.pageSize.height - 8,
          { align: 'center' }
        );
      }

      doc.save(`EOD_${todayStr}.pdf`);
      setMessageStatus({ text: `EOD Report saved as EOD_${todayStr}.pdf`, type: 'success' });
      setTimeout(() => setMessageStatus({ text: '', type: '' }), 4000);

    } catch (err) {
      console.error('EOD generation error:', err);
      setMessageStatus({ text: `EOD Error: ${err.message}`, type: 'error' });
      setTimeout(() => setMessageStatus({ text: '', type: '' }), 5000);
    }
  };

  const isAdmin = 
    currentUser?.role?.toUpperCase() === 'ADMIN' || 
    currentUser?.employeeId?.toUpperCase() === 'ADMIN';

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
          {isAdmin && (
            <button
              onClick={generateEODReport}
              className="flex items-center gap-2 whitespace-nowrap text-xs py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-200 dark:shadow-none"
              title="Download End of Day PDF Report"
            >
              📊 Download EOD PDF Report
            </button>
          )}
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

      {/* Maturity Forecast Widget Section */}
      <div className="card !p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight font-mono">Maturity Forecast & Due Payments</h3>
          </div>
          <span className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider font-mono">
            {todayStr}
          </span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[250px] overflow-y-auto">
          {maturedEntries.length > 0 ? (
            maturedEntries.map(entry => {
              const netValue = parseFloat(entry.netAmount || 0);
              const paidValue = parseFloat(entry.amountPaid || 0);
              const balanceLeft = Math.max(0, netValue - paidValue);
              return (
                <div key={entry.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex justify-between items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400 font-mono">#{entry.tokenNo}</span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-1.5 py-0.5 rounded uppercase">
                        {entry.paymentMode || 'N/A'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase mt-1">
                      {entry.Name || entry.farmerName || 'UNKNOWN'}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                      Village: {entry.Village || 'N/A'} • Phone: {entry.farmerPhone || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white font-mono">
                      ₹{netValue.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs font-bold text-red-500 dark:text-red-400 font-mono">
                      Bal: ₹{balanceLeft.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-slate-400 dark:text-slate-500 text-sm italic text-center py-8">
              No payments maturing today ({todayStr})
            </p>
          )}
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
                            <User className="w-3 h-3 text-slate-400 dark:text-slate-500" /> {d.driverName || 'N/A'}
                            {d.driverPhone && (
                              <a 
                                href={`tel:${d.driverPhone}`}
                                className="p-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-200 transition-colors"
                              >
                                <Phone className="w-2.5 h-2.5" />
                              </a>
                            )}
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