import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  where
} from "firebase/firestore";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Coins,
  X,
  Calendar,
  User,
  MapPin,
  AlertTriangle,
  Clock,
  Share2,
  Calculator,
  CheckSquare,
  MessageSquare,
  Send,
  Bell,
  Phone
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export let globalAavakEntries: any[] = [];
export let globalJavakEntries: any[] = [];
let globalListeners: any[] = [];

const setupGlobalListeners = () => {
  onSnapshot(collection(db, "cottonEntries"), (snapshot) => {
    globalAavakEntries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    globalListeners.forEach((l) => {
      if (l.type === "aavak") {
        l.callback(globalAavakEntries);
      }
    });
  });

  onSnapshot(collection(db, "javakEntries"), (snapshot) => {
    globalJavakEntries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    globalListeners.forEach((l) => {
      if (l.type === "javak") {
        l.callback(globalJavakEntries);
      }
    });
  });
};

setupGlobalListeners();

export const subscribeToAavak = (callback: (data: any[]) => void) => {
  globalListeners.push({ type: "aavak", callback });
  callback(globalAavakEntries);
  return () => {
    globalListeners = globalListeners.filter((l) => l.callback !== callback);
  };
};

export const subscribeToJavak = (callback: (data: any[]) => void) => {
  globalListeners.push({ type: "javak", callback });
  callback(globalJavakEntries);
  return () => {
    globalListeners = globalListeners.filter((l) => l.callback !== callback);
  };
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: any;
  color: string;
}

const StatCard = ({ title, value, icon: Icon, color }: StatCardProps) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex items-center gap-4">
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  </div>
);

interface DashboardProps {
  currentUser: any;
}

export default function Dashboard({ currentUser }: DashboardProps) {
  const [stats, setStats] = useState({
    totalAavakNetWt: 0,
    totalAavakAmount: 0,
    totalJavakNetWt: 0,
    totalJavakBags: 0,
    todayAavakWt: 0,
    todayJavakTrucks: 0,
    todayAavakAmount: 0
  });
  const [cashBalance, setCashBalance] = useState(0);
  const [itemBreakdown, setItemBreakdown] = useState<any>({});
  const [rawData, setRawData] = useState<{ aavak: any[]; javak: any[] }>({ aavak: [], javak: [] });
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [bardanaStock, setBardanaStock] = useState(0);
  const [bardanaBreakdown, setBardanaBreakdown] = useState<any>({});
  const [showAlert, setShowAlert] = useState(false);
  const [adminNotes, setAdminNotes] = useState<any[]>([]);
  const [adminTasks, setAdminTasks] = useState<any[]>([]);
  const [rateChart, setRateChart] = useState<any[]>([]);
  const [myMessages, setMyMessages] = useState<any[]>([]);
  const [employeeMessage, setEmployeeMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messageStatus, setMessageStatus] = useState({ text: "", type: "" });

  // Custom Period Summary State
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Out-turn Calculator State
  const [calcKapas, setCalcKapas] = useState("");
  const [outTurnResults, setOutTurnResults] = useState<any>(null);
  const [eodDate, setEodDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];

    let aavakDataGlobal: any[] = [];
    let javakDataGlobal: any[] = [];

    const handleDataUpdate = (aavakData: any[], javakData: any[]) => {
      let totalAavakWt = 0;
      let totalAavakAmt = 0;
      let totalJavakWt = 0;
      let totalJavakBags = 0;
      let todayAavakWt = 0;
      let todayJavakTrucks = 0;
      let todayAavakAmt = 0;
      const breakdown: any = {};

      aavakData.forEach((data) => {
        const weight = parseFloat(data.netWt || 0);
        const item = data.itemName || "Uncategorized";
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

      javakData.forEach((data) => {
        const weight = parseFloat(data.netWt || 0);
        const item = data.commodity || "Uncategorized";
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
    };

    const unsubscribeNotes = onSnapshot(
      query(collection(db, "adminNotes"), orderBy("timestamp", "desc")),
      (snapshot) => {
        setAdminNotes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any)));
      }
    );

    const unsubscribeTasks = onSnapshot(
      query(collection(db, "adminTasks"), orderBy("timestamp", "desc")),
      (snapshot) => {
        const allTasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
        const myTasks = allTasks.filter((task) => {
          if (currentUser?.role?.toUpperCase() === "ADMIN" || currentUser?.employeeId === "ADMIN") return true;
          return task.assignedTo === currentUser?.employeeId;
        });
        setAdminTasks(myTasks);
      }
    );

    const unsubscribeRates = onSnapshot(
      query(collection(db, "rateCharts"), orderBy("timestamp", "desc")),
      (snapshot) => {
        setRateChart(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any)));
      }
    );

    const unsubscribeMyMessages = onSnapshot(
      query(collection(db, "employeeMessages"), orderBy("timestamp", "desc")),
      (snapshot) => {
        const allMsgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
        const filtered = allMsgs.filter((msg) => msg.senderId === currentUser?.employeeId);
        setMyMessages(filtered);
      }
    );

    const unsubscribeCash = onSnapshot(collection(db, "cashTransactions"), (snapshot) => {
      let totalIn = 0;
      let totalOut = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.type === "IN") totalIn += data.amount || 0;
        else totalOut += data.amount || 0;
      });
      setCashBalance(totalIn - totalOut);
    });

    const unsubscribeBardana = onSnapshot(collection(db, "bardana"), (snapshot) => {
      let totalGunny = 0;
      const breakdown: any = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const item = data.itemName?.toUpperCase() || "UNKNOWN";
        const qty = parseInt(data.quantity || 0, 10);

        if (data.type === "IN") {
          breakdown[item] = (breakdown[item] || 0) + qty;
        } else {
          breakdown[item] = (breakdown[item] || 0) - qty;
        }

        if (item === "GUNNY BAGS" || item === "GUNNY BAG" || item === "BARDANA") {
          totalGunny += qty * (data.type === "IN" ? 1 : -1);
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

    const unsubscribeAavak = subscribeToAavak((data) => {
      aavakDataGlobal = data;
      handleDataUpdate(aavakDataGlobal, javakDataGlobal);
    });

    const unsubscribeJavak = subscribeToJavak((data) => {
      javakDataGlobal = data;
      handleDataUpdate(aavakDataGlobal, javakDataGlobal);
    });

    return () => {
      unsubscribeAavak();
      unsubscribeJavak();
      unsubscribeBardana();
      unsubscribeNotes();
      unsubscribeTasks();
      unsubscribeRates();
      unsubscribeMyMessages();
      unsubscribeCash();
    };
  }, [currentUser?.employeeId, currentUser?.role]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeMessage.trim() || !currentUser) return;

    setIsSending(true);
    try {
      await addDoc(collection(db, "employeeMessages"), {
        content: employeeMessage.toUpperCase(),
        senderName: currentUser.name,
        senderId: currentUser.employeeId,
        timestamp: serverTimestamp()
      });
      setEmployeeMessage("");
      setMessageStatus({ text: "Message sent to Admin!", type: "success" });
      setTimeout(() => setMessageStatus({ text: "", type: "" }), 3000);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageStatus({ text: "Failed to send message", type: "error" });
    } finally {
      setIsSending(false);
    }
  };

  const handleShareSummary = () => {
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long" });
    const aavakQuintals = (stats.todayAavakWt / 100).toFixed(1);
    const summaryText =
      `*VCC COTTON SUMMARY - ${today.toUpperCase()}*\n\n` +
      `📥 *AAVAK:* ${aavakQuintals} QNTL\n` +
      `🚚 *DISPATCH:* ${stats.todayJavakTrucks} TRUCKS\n` +
      `💰 *TODAY'S PAYOUT:* INR ${stats.todayAavakAmount.toLocaleString()}\n\n` +
      `_Generated via VCC Cotton App_`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleCopySummary = () => {
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long" });
    const aavakQuintals = (stats.todayAavakWt / 100).toFixed(1);
    const summaryText =
      `*VCC COTTON SUMMARY - ${today.toUpperCase()}*\n\n` +
      `📥 *AAVAK:* ${aavakQuintals} QNTL\n` +
      `🚚 *DISPATCH:* ${stats.todayJavakTrucks} TRUCKS\n` +
      `💰 *TODAY'S PAYOUT:* INR ${stats.todayAavakAmount.toLocaleString()}\n\n` +
      `_Generated via VCC Cotton App_`;

    navigator.clipboard.writeText(summaryText).then(() => {
      setMessageStatus({ text: "Summary copied!", type: "success" });
      setTimeout(() => setMessageStatus({ text: "", type: "" }), 3000);
    });
  };

  const getCustomPeriodStats = () => {
    if (!startDate || !endDate) return null;

    let totalAavakWt = 0;
    let totalAavakAmt = 0;
    let totalJavakTrucks = 0;

    rawData.aavak.forEach((data) => {
      if (data.billingDate >= startDate && data.billingDate <= endDate) {
        totalAavakWt += parseFloat(data.netWt || 0);
        totalAavakAmt += parseFloat(data.amountPaid || 0);
      }
    });

    rawData.javak.forEach((data) => {
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

    const start = new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const end = new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

    const summaryText =
      `*VCC COTTON SUMMARY*\n*PERIOD:* ${start.toUpperCase()} TO ${end.toUpperCase()}\n\n` +
      `📥 *AAVAK:* ${periodStats.aavakWt} QNTL\n` +
      `🚚 *DISPATCH:* ${periodStats.javakTrucks} TRUCKS\n` +
      `💰 *TOTAL PAYOUT:* INR ${periodStats.aavakAmt}\n\n` +
      `_Generated via VCC Cotton App_`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleCopyPeriodSummary = () => {
    const periodStats = getCustomPeriodStats();
    if (!periodStats) return;

    const start = new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const end = new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

    const summaryText =
      `*VCC COTTON SUMMARY*\n*PERIOD:* ${start.toUpperCase()} TO ${end.toUpperCase()}\n\n` +
      `📥 *AAVAK:* ${periodStats.aavakWt} QNTL\n` +
      `🚚 *DISPATCH:* ${periodStats.javakTrucks} TRUCKS\n` +
      `💰 *TOTAL PAYOUT:* INR ${periodStats.aavakAmt}\n\n` +
      `_Generated via VCC Cotton App_`;

    navigator.clipboard.writeText(summaryText).then(() => {
      alert("Period summary copied!");
    });
  };

  const copyOutTurnToClipboard = () => {
    if (!outTurnResults) return;
    const text =
      `*VCC OUT-TURN ESTIMATE*\n` +
      `Kapas: ${calcKapas} kg\n` +
      `Lint: ${outTurnResults.lint} kg\n` +
      `Seed: ${outTurnResults.seed} kg\n` +
      `Bales: ~${outTurnResults.bales}`;

    navigator.clipboard.writeText(text).then(() => {
      alert("Results copied to clipboard!");
    });
  };

  const calculateOutTurn = (val: string) => {
    const kapas = parseFloat(val);
    if (isNaN(kapas) || kapas <= 0) {
      setOutTurnResults(null);
      return;
    }
    const lint = kapas * 0.34;
    const seed = kapas * 0.63;
    const bales = lint / 170;

    setOutTurnResults({
      lint: lint.toFixed(2),
      seed: seed.toFixed(2),
      bales: bales.toFixed(1)
    });
  };

  const getFilteredDetails = (itemName: string) => {
    const aavakDetails = rawData.aavak.filter((d) => (d.itemName || "Uncategorized") === itemName);
    const javakDetails = rawData.javak.filter((d) => (d.commodity || "Uncategorized") === itemName);
    return { aavakDetails, javakDetails };
  };

  const generateEODReport = (rawEntries: any[], selectedDate: string, operatorName = currentUser?.name || "Admin Counter") => {
    const todayStrLocal = selectedDate || new Date().toISOString().split("T")[0];
    const baseEntries = rawEntries || rawData.aavak || [];
    const todayEntries = baseEntries.filter((entry) => entry.billingDate === todayStrLocal);

    const totalPattis = todayEntries.length;
    let totalAccumulatedWeight = 0;
    let grossOutflowCommitted = 0;
    let realizedOutflowPaid = 0;

    const rows = todayEntries.map((entry) => {
      const tokenNoStr = entry.tokenNo || entry.id || "N/A";
      const farmerName = entry.Name || entry.farmerName || "N/A";
      const netWeight = parseFloat(entry.netWt || entry.netWeight || 0);
      const netAmount = parseFloat(entry.netAmount || 0);

      let paidAmount = 0;
      if (entry.paymentHistory && Array.isArray(entry.paymentHistory)) {
        entry.paymentHistory.forEach((item) => {
          if (item.date === todayStrLocal) {
            paidAmount += parseFloat(item.amount || 0);
          }
        });
      } else {
        paidAmount = parseFloat(entry.amountPaid || 0);
      }

      const remainingBalance = netAmount - paidAmount;

      totalAccumulatedWeight += netWeight;
      grossOutflowCommitted += netAmount;
      realizedOutflowPaid += paidAmount;

      return [
        tokenNoStr,
        farmerName,
        `${netWeight.toLocaleString("en-IN")} kg`,
        `INR ${netAmount.toLocaleString("en-IN")}`,
        `INR ${paidAmount.toLocaleString("en-IN")}`,
        `INR ${remainingBalance.toLocaleString("en-IN")}`
      ];
    });

    const remainingOutstandingLiability = grossOutflowCommitted - realizedOutflowPaid;

    const docRef = new jsPDF();

    docRef.setFillColor(15, 23, 42);
    docRef.rect(0, 0, 210, 40, "F");

    docRef.setTextColor(255, 255, 255);
    docRef.setFont("Helvetica", "bold");
    docRef.setFontSize(16);
    docRef.text("VENKATESH COTTON COMPANY", 14, 15);
    docRef.setFontSize(11);
    docRef.setFont("Helvetica", "normal");
    docRef.text("MANDI OPERATIONS - DAILY EOD REPORT", 14, 23);

    const displayDate = new Date(todayStrLocal + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    docRef.setFontSize(9);
    docRef.text(`REPORT DATE: ${displayDate}`, 14, 32);
    docRef.text(`OPERATOR: ${operatorName.toUpperCase()}`, 140, 32);

    const startY = 50;
    docRef.setFillColor(248, 250, 252);
    docRef.rect(14, startY, 182, 35, "F");
    docRef.setDrawColor(226, 232, 240);
    docRef.rect(14, startY, 182, 35, "S");

    docRef.setTextColor(15, 23, 42);
    docRef.setFontSize(10);
    docRef.setFont("Helvetica", "bold");
    docRef.text("TODAY'S RUNNING METRICS SUMMARY", 20, startY + 8);

    docRef.setFont("Helvetica", "normal");
    docRef.setFontSize(9);
    docRef.text(`Total Pattis Generated: ${totalPattis}`, 20, startY + 16);
    docRef.text(`Acc. Weight Received: ${totalAccumulatedWeight.toLocaleString("en-IN")} kg`, 20, startY + 22);
    docRef.text(`Gross Outflow:        INR ${grossOutflowCommitted.toLocaleString("en-IN")}`, 20, startY + 28);

    docRef.text(`Realized Paid Today: INR ${realizedOutflowPaid.toLocaleString("en-IN")}`, 110, startY + 16);
    docRef.setFont("Helvetica", "bold");
    docRef.text(`Outstanding Credit:  INR ${remainingOutstandingLiability.toLocaleString("en-IN")}`, 110, startY + 22);

    autoTable(docRef, {
      startY: startY + 45,
      head: [["Token No", "Farmer Name", "Net Wt", "Net Amount", "Paid Today", "Remaining"]],
      body: rows,
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      styles: {
        lineColor: [241, 245, 249],
        lineWidth: 0.5
      }
    });

    const finalY = (docRef as any).lastAutoTable.finalY || startY + 90;
    const pageHeight = docRef.internal.pageSize.height;

    let sigY = finalY + 25;
    if (sigY > pageHeight - 30) {
      docRef.addPage();
      sigY = 40;
    }

    docRef.setFont("Helvetica", "normal");
    docRef.setFontSize(9);
    docRef.setTextColor(71, 85, 105);

    docRef.text("__________________________", 20, sigY);
    docRef.setFont("Helvetica", "bold");
    docRef.text("Accountant Signature", 20, sigY + 5);

    docRef.text("__________________________", 130, sigY);
    docRef.setFont("Helvetica", "bold");
    docRef.text("Authorized Admin Sign", 130, sigY + 5);

    docRef.save(`EOD_Report_${todayStrLocal}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Dashboard Overview</h2>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {(currentUser?.role?.toUpperCase() === "ADMIN" || currentUser?.employeeId === "ADMIN") && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
              <input
                type="date"
                value={eodDate}
                onChange={(e) => setEodDate(e.target.value)}
                className="bg-transparent text-xs font-bold font-mono px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 border-none rounded-lg"
              />
              <button
                onClick={() => generateEODReport(rawData.aavak, eodDate)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 uppercase tracking-wide shadow-sm cursor-pointer"
              >
                <span>DAILY REPORT</span>
              </button>
            </div>
          )}
          <button
            onClick={() => setIsPeriodModalOpen(true)}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 whitespace-nowrap tracking-wider"
          >
            <Calendar className="w-4 h-4" /> Period Summary
          </button>
          <button
            onClick={handleCopySummary}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 whitespace-nowrap tracking-wider"
          >
            <Share2 className="w-4 h-4" /> Copy Today
          </button>
          <button
            onClick={handleShareSummary}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 whitespace-nowrap tracking-wider"
          >
            <Share2 className="w-4 h-4" /> Share WA
          </button>
        </div>
      </div>

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
                <button
                  onClick={() => setIsPeriodModalOpen(false)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 utils uppercase">From Date</label>
                    <input
                      type="date"
                      className="input-field w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 utils uppercase">To Date</label>
                    <input
                      type="date"
                      className="input-field w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
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
                      <span className="font-bold text-emerald-600">INR {getCustomPeriodStats()?.aavakAmt}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button
                    onClick={handleCopyPeriodSummary}
                    disabled={!startDate || !endDate}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl py-3 text-xs font-bold uppercase transition-all disabled:opacity-50"
                  >
                    Copy Text
                  </button>
                  <button
                    onClick={handleSharePeriodSummary}
                    disabled={!startDate || !endDate}
                    className="bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl py-3 text-xs font-bold uppercase transition-all disabled:opacity-50"
                  >
                    Share WA
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">Today's Aavak</p>
          <p className="text-3xl font-black">
            {(stats.todayAavakWt / 100).toFixed(1)} <span className="text-sm font-bold opacity-60">QNTL</span>
          </p>
        </div>
        <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200 dark:shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">Today's Payout</p>
          <p className="text-3xl font-black font-mono">INR {stats.todayAavakAmount.toLocaleString()}</p>
        </div>
        <div className="bg-orange-600 rounded-2xl p-6 text-white shadow-lg shadow-orange-200 dark:shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">Today's Dispatch</p>
          <p className="text-3xl font-black">
            {stats.todayJavakTrucks} <span className="text-sm font-bold opacity-60">TRUCKS</span>
          </p>
        </div>
        {(currentUser?.role?.toUpperCase() === "ADMIN" ||
          currentUser?.employeeId === "ADMIN" ||
          currentUser?.role?.toUpperCase() === "CASHIER") && (
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg shadow-slate-200 dark:shadow-none">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">Cash Balance</p>
            <p className="text-3xl font-black font-mono">INR {cashBalance.toLocaleString()}</p>
          </div>
        )}
      </div>

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
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Stock Warning!
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 font-medium">Bardana stock is dangerously low!</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-100 dark:border-red-800/50">
                  <p className="text-sm text-red-600 dark:text-red-400 font-bold uppercase tracking-widest mb-1">
                    Bardana Stock
                  </p>
                  <p className="text-5xl font-black text-red-700 dark:text-red-500">{bardanaStock}</p>
                  <p className="text-xs text-red-400 dark:text-red-500/60 mt-2 font-semibold italic">
                    Minimum required: 100 Bags
                  </p>
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
          title="Total Incoming"
          value={`${stats.totalAavakNetWt.toLocaleString()} kg`}
          icon={TrendingUp}
          color="bg-emerald-500"
        />
        <StatCard
          title="Amount Paid"
          value={`INR ${stats.totalAavakAmount.toLocaleString()}`}
          icon={Coins}
          color="bg-indigo-500"
        />
        <StatCard
          title="Total Outgoing"
          value={`${stats.totalJavakNetWt.toLocaleString()} kg`}
          icon={TrendingDown}
          color="bg-orange-500"
        />
        <StatCard title="Total Outgoing Bags" value={stats.totalJavakBags.toLocaleString()} icon={Package} color="bg-blue-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
              Dashboard Notes
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[250px] overflow-y-auto">
            {adminNotes.length > 0 ? (
              adminNotes.map((note) => (
                <div key={note.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase leading-relaxed">
                    {note.content}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                    <Clock className="w-3 h-3" />
                    {note.timestamp?.toDate().toLocaleString()} • BY {note.author}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm italic text-center py-8">
                No public notes at this time
              </p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
              My Private Tasks
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[250px] overflow-y-auto">
            {adminTasks.length > 0 ? (
              adminTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-l-4 border-amber-500"
                >
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase leading-relaxed">
                    {task.content}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                    <Clock className="w-3 h-3" />
                    {task.timestamp?.toDate().toLocaleString()} • FROM ADMIN
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm italic text-center py-8">
                No private tasks assigned to you
              </p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold uppercase tracking-tight">Current Rate Chart</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rateChart.length > 0 ? (
              rateChart.map((rate) => (
                <div
                  key={rate.id}
                  className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl"
                >
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">
                    {rate.itemName}
                  </span>
                  <span className="font-black text-emerald-700 dark:text-emerald-400">Rs. {rate.rate}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm italic col-span-2 text-center py-4">
                No rates published yet
              </p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Message Admin</h3>
            </div>
            <form onSubmit={handleSendMessage} className="space-y-3">
              <textarea
                className="input-field w-full min-h-[80px] p-3 border rounded-xl text-sm uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                placeholder="SEND A NOTE OR REPORT TO ADMIN..."
                value={employeeMessage}
                onChange={(e) => setEmployeeMessage(e.target.value.toUpperCase())}
                required
              />
              <div className="flex items-center justify-between gap-2">
                {messageStatus.text && (
                  <span
                    className={`text-[10px] font-bold ${
                      messageStatus.type === "success" ? "text-emerald-600" : "text-red-650"
                    }`}
                  >
                    {messageStatus.text}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isSending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase ml-auto cursor-pointer"
                >
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>

          {myMessages.length > 0 && (
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                My Recent Messages
              </h4>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {myMessages.map((msg) => (
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

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Bardana Stock</h3>
          <div className="space-y-3">
            {Object.entries(bardanaBreakdown).length > 0 ? (
              Object.entries(bardanaBreakdown)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([item, qty]: any) => (
                  <div
                    key={item}
                    className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${qty < 100 ? "bg-red-500" : "bg-emerald-500"}`}></div>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{item}</span>
                    </div>
                    <span className={`font-bold ${qty < 100 ? "text-red-650" : "text-slate-900 dark:text-white"}`}>
                      {qty.toLocaleString()} Bags
                    </span>
                  </div>
                ))
            ) : (
              <p className="text-slate-400 text-sm italic py-4 text-center">No Bardana data</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Current Stock by Item</h3>
          <div className="space-y-3">
            {Object.entries(itemBreakdown).length > 0 ? (
              Object.entries(itemBreakdown)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([item, weight]: any) => (
                  <div
                    key={item}
                    onClick={() => setSelectedItem(item)}
                    className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${weight < 0 ? "bg-red-500" : "bg-indigo-500"}`}></div>
                      <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">
                        {item}
                      </span>
                    </div>
                    <span className={`font-bold ${weight < 0 ? "text-red-650" : "text-slate-900 dark:text-white"}`}>
                      {weight.toLocaleString()} kg
                    </span>
                  </div>
                ))
            ) : (
              <p className="text-slate-400 text-sm italic py-4 text-center">No data available</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
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

        <div className="bg-gradient-to-br from-indigo-600 to-indigo-850 text-white p-6 rounded-2xl shadow-sm border-none">
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
                  className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer"
                >
                  Copy Results
                </button>
              </div>
            )}
            <p className="text-[9px] opacity-50 italic">* Based on standard 34% Lint and 63% Seed yield ratios.</p>
          </div>
        </div>
      </div>

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
                <div className="space-y-4">
                  <h4 className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 border-b border-emerald-100 dark:border-emerald-900/30 pb-2">
                    <TrendingUp className="w-4 h-4" /> Aavak (Incoming)
                  </h4>
                  <div className="space-y-3">
                    {getFilteredDetails(selectedItem).aavakDetails.length > 0 ? (
                      getFilteredDetails(selectedItem).aavakDetails.map((d) => (
                        <div
                          key={d.id}
                          className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">
                              #{d.tokenNo}
                            </span>
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

                <div className="space-y-4">
                  <h4 className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2 border-b border-orange-100 dark:border-orange-900/30 pb-2">
                    <TrendingDown className="w-4 h-4" /> Javak (Outgoing)
                  </h4>
                  <div className="space-y-3">
                    {getFilteredDetails(selectedItem).javakDetails.length > 0 ? (
                      getFilteredDetails(selectedItem).javakDetails.map((d) => (
                        <div
                          key={d.id}
                          className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">
                              #{d.gatePassNo}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {d.date}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-medium col-span-2">
                            <User className="w-3 h-3 text-slate-400 dark:text-slate-500" /> {d.driverName || "N/A"}{" "}
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
