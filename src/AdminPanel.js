import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { Save, Trash2, Plus, CheckSquare, IndianRupee, Shield, Mail, Clock } from 'lucide-react';
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

        return () => {
            unsubscribeNotes();
            unsubscribeTasks();
            unsubscribeRates();
            unsubscribeEmployees();
            unsubscribeMessages();
        };
    }, [isAdmin]);

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

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center space-y-4">
                    <Shield className="w-16 h-16 text-red-500 mx-auto" />
                    <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
                    <p className="text-slate-500">Only administrators can access this panel.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900">Admin Control Panel</h2>
                {statusMessage.text && (
                    <div className={`px-4 py-2 rounded-lg text-sm font-bold animate-in fade-in slide-in-from-right-4 ${
                        statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                        {statusMessage.text}
                    </div>
                )}
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
                                className="input-field min-h-[80px] uppercase" 
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
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <h4 className="font-bold text-slate-700">Recent Dashboard Notes</h4>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                            {dashboardNotes.length > 0 ? (
                                dashboardNotes.map(n => (
                                    <div key={n.id} className="p-4 flex justify-between items-start gap-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-900 font-medium whitespace-pre-wrap">{n.content}</p>
                                            <p className="text-[10px] text-slate-400 mt-1 uppercase">By {n.author} • {n.timestamp?.toDate().toLocaleString()}</p>
                                        </div>
                                        <button onClick={() => handleDelete('adminNotes', n.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 italic text-sm">No notes posted yet.</div>
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
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Assign To Employee</label>
                                <select 
                                    className="input-field"
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
                                className="input-field min-h-[80px] uppercase" 
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
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <h4 className="font-bold text-slate-700">Recent Private Tasks</h4>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                            {adminTasks.length > 0 ? (
                                adminTasks.map(n => (
                                    <div key={n.id} className="p-4 flex justify-between items-start gap-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-amber-100 text-amber-700">
                                                    To: {n.assignedTo}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-900 font-medium whitespace-pre-wrap">{n.content}</p>
                                            <p className="text-[10px] text-slate-400 mt-1 uppercase">By {n.author} • {n.timestamp?.toDate().toLocaleString()}</p>
                                        </div>
                                        <button onClick={() => handleDelete('adminTasks', n.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 italic text-sm">No tasks assigned yet.</div>
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
                                <label className="text-xs font-bold text-slate-500 uppercase">Item Name</label>
                                <input 
                                    type="text" 
                                    className="input-field uppercase" 
                                    placeholder="E.G., COTTON"
                                    value={itemName}
                                    onChange={(e) => setItemName(e.target.value.toUpperCase())}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Rate (₹)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="input-field" 
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
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <h4 className="font-bold text-slate-700">Current Rates</h4>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {rateChart.map(r => (
                                <div key={r.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="font-bold text-slate-900">{r.itemName}</p>
                                        <p className="text-[10px] text-slate-400 uppercase">Updated: {r.timestamp?.toDate().toLocaleDateString()}</p>
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
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-600" />
                            <h4 className="font-bold text-slate-700 uppercase tracking-tight">Messages from Employees</h4>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                            {employeeMessages.length > 0 ? (
                                employeeMessages.map(msg => (
                                    <div key={msg.id} className="p-4 flex justify-between items-start gap-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-600">
                                                    From: {msg.senderName} ({msg.senderId})
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-900 font-medium whitespace-pre-wrap">{msg.content}</p>
                                            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 uppercase">
                                                <Clock className="w-3 h-3" />
                                                {msg.timestamp?.toDate().toLocaleString()}
                                            </div>
                                        </div>
                                        <button onClick={() => handleDelete('employeeMessages', msg.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 italic text-sm">
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
