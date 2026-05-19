import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, addDoc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { Save, Trash2, Plus, CheckSquare, IndianRupee, Shield, Mail, Clock, MessageSquare, Send, Settings } from 'lucide-react';
import { normalizeItemName } from './utils/normalization';

function AdminPanel({ currentUser }) {
    const [note, setNote] = useState('');
    const [task, setTask] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [employees, setEmployees] = useState([]);
    const [dashboardNotes, setDashboardNotes] = useState([]);
    const [adminTasks, setAdminTasks] = useState([]);
    const [employeeMessages, setEmployeeMessages] = useState([]);
    const [itemName, setItemName] = useState('');
    const [itemRate, setItemRate] = useState('');
    const [rateChart, setRateChart] = useState([]);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyContent, setReplyContent] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);

    // Billing Settings State
    const [hamaliRate, setHamaliRate] = useState(15);
    const [weighmentRate, setWeighmentRate] = useState(50);
    const [deductionPercent, setDeductionPercent] = useState(1.4);
    const [cottonDeduction, setCottonDeduction] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN';

    useEffect(() => {
        if (!isAdmin) return;

        const unsubscribeNotes = onSnapshot(query(collection(db, 'adminNotes'), orderBy('timestamp', 'desc')), (snapshot) => {
            setDashboardNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubscribeTasks = onSnapshot(query(collection(db, 'adminTasks'), orderBy('timestamp', 'desc')), (snapshot) => {
            setAdminTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubscribeRates = onSnapshot(query(collection(db, 'rateChart'), orderBy('timestamp', 'desc')), (snapshot) => {
            setRateChart(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubscribeEmployees = onSnapshot(query(collection(db, 'employees'), orderBy('name', 'asc')), (snapshot) => {
            setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubscribeMessages = onSnapshot(query(collection(db, 'employeeMessages'), orderBy('timestamp', 'desc')), (snapshot) => {
            setEmployeeMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'billing'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setHamaliRate(data.hamaliRate ?? 15);
                setWeighmentRate(data.weighmentRate ?? 50);
                setDeductionPercent(data.generalDeductionPercent ?? 1.4);
                setCottonDeduction(data.cottonDeductionEnabled ?? false);
            }
        });

        return () => {
            unsubscribeNotes();
            unsubscribeTasks();
            unsubscribeRates();
            unsubscribeEmployees();
            unsubscribeMessages();
            unsubscribeSettings();
        };
    }, [isAdmin]);

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setIsSavingSettings(true);
        try {
            await setDoc(doc(db, 'settings', 'billing'), {
                hamaliRate: parseFloat(hamaliRate),
                weighmentRate: parseFloat(weighmentRate),
                generalDeductionPercent: parseFloat(deductionPercent),
                cottonDeductionEnabled: cottonDeduction,
                updatedBy: currentUser.name,
                timestamp: serverTimestamp()
            });
            setStatusMessage({ text: 'Billing settings updated successfully', type: 'success' });
        } catch (error) {
            console.error("Error saving settings:", error);
            setStatusMessage({ text: 'Error saving settings', type: 'error' });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!note.trim()) return;
        try {
            await addDoc(collection(db, 'adminNotes'), {
                content: note.toUpperCase(),
                author: currentUser.name,
                timestamp: serverTimestamp()
            });
            setNote('');
            setStatusMessage({ text: 'Dashboard note added successfully', type: 'success' });
        } catch (error) {
            console.error("Error adding note:", error);
            setStatusMessage({ text: 'Error adding note', type: 'error' });
        }
    };

    const handleAssignTask = async (e) => {
        e.preventDefault();
        if (!task.trim() || !assignedTo) return;
        try {
            await addDoc(collection(db, 'adminTasks'), {
                content: task.toUpperCase(),
                author: currentUser.name,
                assignedTo: assignedTo,
                timestamp: serverTimestamp()
            });
            setTask('');
            setAssignedTo('');
            setStatusMessage({ text: 'Task assigned successfully', type: 'success' });
        } catch (error) {
            console.error("Error assigning task:", error);
            setStatusMessage({ text: 'Error assigning task', type: 'error' });
        }
    };

    const handleAddRate = async (e) => {
        e.preventDefault();
        if (!itemName.trim() || !itemRate) return;
        try {
            await addDoc(collection(db, 'rateChart'), {
                itemName: normalizeItemName(itemName),
                rate: parseFloat(itemRate),
                timestamp: serverTimestamp()
            });
            setItemName('');
            setItemRate('');
            setStatusMessage({ text: 'Rate added successfully', type: 'success' });
        } catch (error) {
            console.error("Error adding rate:", error);
            setStatusMessage({ text: 'Error adding rate', type: 'error' });
        }
    };

    const handleDelete = async (coll, id) => {
        try {
            await deleteDoc(doc(db, coll, id));
            setStatusMessage({ text: 'Deleted successfully', type: 'success' });
        } catch (error) {
            console.error("Error deleting:", error);
            setStatusMessage({ text: 'Error deleting', type: 'error' });
        }
    };

    const handleSendReply = async (msgId) => {
        if (!replyContent.trim()) return;
        setIsSendingReply(true);
        try {
            await updateDoc(doc(db, 'employeeMessages', msgId), {
                reply: replyContent.toUpperCase(),
                replyTimestamp: serverTimestamp(),
                repliedBy: currentUser.name
            });
            setReplyContent('');
            setReplyingTo(null);
            setStatusMessage({ text: 'Reply sent successfully', type: 'success' });
        } catch (error) {
            console.error("Error sending reply:", error);
            setStatusMessage({ text: 'Error sending reply', type: 'error' });
        } finally {
            setIsSendingReply(false);
        }
    };

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center space-y-4">
                    <Shield className="w-16 h-16 text-red-500 mx-auto" />
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Access Denied</h2>
                    <p className="text-slate-500 dark:text-slate-400">Only administrators can access this panel.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Control Panel</h2>
                {statusMessage.text && (
                    <div className={`px-4 py-2 rounded-lg text-sm font-bold animate-in fade-in slide-in-from-right-4 ${
                        statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                        {statusMessage.text}
                    </div>
                )}
            </div>

            {/* Global Billing Settings - Full Width at Top */}
            <div className="card border-2 border-indigo-100 dark:border-indigo-900/50 shadow-indigo-100 dark:shadow-none">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <Settings className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Global Billing Deductions</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Control hamali rates and percentage deductions across the app</p>
                    </div>
                </div>
                
                <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Hamali Rate (₹/Qntl)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                            <input 
                                type="number" 
                                step="0.01"
                                className="input-field pl-8 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold" 
                                value={hamaliRate}
                                onChange={(e) => setHamaliRate(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Weighment (₹/Qntl)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                            <input 
                                type="number" 
                                step="0.01"
                                className="input-field pl-8 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold" 
                                value={weighmentRate}
                                onChange={(e) => setWeighmentRate(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-red-500 uppercase tracking-widest">General Deduction (%)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                step="0.001"
                                className="input-field pr-8 border-red-200 dark:border-red-900/50 dark:bg-slate-800 dark:text-white font-bold" 
                                value={deductionPercent}
                                onChange={(e) => setDeductionPercent(e.target.value)}
                                required
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 font-bold">%</span>
                        </div>
                    </div>
                    <div className="flex flex-col justify-end gap-3">
                        <div className="flex items-center gap-3 pb-2">
                            <input 
                                type="checkbox" 
                                id="cottonDed_top"
                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                checked={cottonDeduction}
                                onChange={(e) => setCottonDeduction(e.target.checked)}
                            />
                            <label htmlFor="cottonDed_top" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase cursor-pointer">Apply to Cotton</label>
                        </div>
                        <button 
                            type="submit" 
                            disabled={isSavingSettings}
                            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                        >
                            {isSavingSettings ? 'Updating...' : <><Save className="w-4 h-4" /> Save Global Rates</>}
                        </button>
                    </div>
                </form>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Dashboard Notes Management */}
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-600" />
                            Dashboard Notes (Public)
                        </h3>
                        <form onSubmit={handleAddNote} className="space-y-4">
                            <textarea 
                                className="input-field min-h-[80px] uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                placeholder="ENTER PUBLIC ANNOUNCEMENT..."
                                value={note}
                                onChange={(e) => setNote(e.target.value.toUpperCase())}
                                required
                            />
                            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                                <Plus className="w-4 h-4" /> Post Note
                            </button>
                        </form>
                    </div>

                    <div className="card !p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300">Recent Dashboard Notes</h4>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
                            {dashboardNotes.length > 0 ? (
                                dashboardNotes.map(n => (
                                    <div key={n.id} className="p-4 flex justify-between items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-900 dark:text-slate-100 font-medium whitespace-pre-wrap">{n.content}</p>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase">By {n.author} • {n.timestamp?.toDate().toLocaleString()}</p>
                                        </div>
                                        <button onClick={() => handleDelete('adminNotes', n.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-sm">No notes posted yet.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tasks Management */}
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <CheckSquare className="w-5 h-5 text-amber-600" />
                            Assign Private Tasks
                        </h3>
                        <form onSubmit={handleAssignTask} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Assign To Employee</label>
                                <select 
                                    className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    value={assignedTo}
                                    onChange={(e) => setAssignedTo(e.target.value)}
                                    required
                                >
                                    <option value="">SELECT EMPLOYEE...</option>
                                    {employees.map(emp => (
                                        <option key={emp.employeeId} value={emp.employeeId}>{emp.name} ({emp.employeeId})</option>
                                    ))}
                                </select>
                            </div>
                            <textarea 
                                className="input-field min-h-[80px] uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                placeholder="DESCRIBE THE PRIVATE TASK..."
                                value={task}
                                onChange={(e) => setTask(e.target.value.toUpperCase())}
                                required
                            />
                            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 border-amber-600">
                                <Plus className="w-4 h-4" /> Assign Task
                            </button>
                        </form>
                    </div>

                    <div className="card !p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300">Recent Private Tasks</h4>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
                            {adminTasks.length > 0 ? (
                                adminTasks.map(n => (
                                    <div key={n.id} className="p-4 flex justify-between items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                                    To: {n.assignedTo}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-900 dark:text-slate-100 font-medium whitespace-pre-wrap">{n.content}</p>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase">By {n.author} • {n.timestamp?.toDate().toLocaleString()}</p>
                                        </div>
                                        <button onClick={() => handleDelete('adminTasks', n.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-sm">No tasks assigned yet.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Rate Chart Management */}
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <IndianRupee className="w-5 h-5 text-emerald-600" />
                            Manage Rate Chart
                        </h3>
                        <form onSubmit={handleAddRate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Item Name</label>
                                <input 
                                    type="text" 
                                    className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    placeholder="E.G., COTTON"
                                    value={itemName}
                                    onChange={(e) => setItemName(e.target.value.toUpperCase())}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Rate (₹)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    placeholder="0.00"
                                    value={itemRate}
                                    onChange={(e) => setItemRate(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="sm:col-span-2 btn-primary flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" /> Save to Rate Chart
                            </button>
                        </form>
                    </div>

                    <div className="card !p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300">Current Rates</h4>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {rateChart.map(r => (
                                <div key={r.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-slate-100">{r.itemName}</p>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Updated: {r.timestamp?.toDate().toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-lg font-black text-emerald-600">₹{r.rate}</span>
                                        <button onClick={() => handleDelete('rateChart', r.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Employee Messages Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card !p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-600" />
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">Messages from Employees</h4>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
                            {employeeMessages.length > 0 ? (
                                employeeMessages.map(msg => (
                                    <div key={msg.id} className="p-4 flex justify-between items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                    From: {msg.senderName} ({msg.senderId})
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-900 dark:text-slate-100 font-medium whitespace-pre-wrap">{msg.content}</p>
                                            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 dark:text-slate-500 uppercase">
                                                <Clock className="w-3 h-3" />
                                                {msg.timestamp?.toDate().toLocaleString()}
                                            </div>

                                            {msg.reply && (
                                                <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-lg">
                                                    <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1 flex items-center gap-1">
                                                        <MessageSquare className="w-3 h-3" /> Admin Reply:
                                                    </p>
                                                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap">{msg.reply}</p>
                                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 uppercase">
                                                        By {msg.repliedBy} • {msg.replyTimestamp?.toDate().toLocaleString()}
                                                    </p>
                                                </div>
                                            )}

                                            {replyingTo === msg.id ? (
                                                <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                                                    <textarea 
                                                        className="input-field min-h-[60px] text-xs uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                                        placeholder="TYPE YOUR REPLY..."
                                                        value={replyContent}
                                                        onChange={(e) => setReplyContent(e.target.value.toUpperCase())}
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => setReplyingTo(null)}
                                                            className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            onClick={() => handleSendReply(msg.id)}
                                                            disabled={isSendingReply}
                                                            className="btn-primary py-1.5 px-3 text-[10px] flex items-center gap-1"
                                                        >
                                                            {isSendingReply ? 'Sending...' : <><Send className="w-3 h-3" /> Send Reply</>}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => {
                                                        setReplyingTo(msg.id);
                                                        setReplyContent(msg.reply || '');
                                                    }}
                                                    className="mt-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase hover:underline flex items-center gap-1"
                                                >
                                                    <MessageSquare className="w-3 h-3" /> {msg.reply ? 'Edit Reply' : 'Reply'}
                                                </button>
                                            )}
                                        </div>
                                        <button onClick={() => handleDelete('employeeMessages', msg.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-sm">
                                    No messages from employees yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminPanel;
