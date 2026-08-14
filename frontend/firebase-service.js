// Firebase Service Layer — Real-Time Cloud Firestore & Auth for GeoSafe

// 1. Submit Disaster / SOS Report to Firestore
async function fbSubmitReport(report) {
  if (db) {
    const docRef = await db.collection('reports').add({
      ...report,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      status: report.status || 'pending',
      severity: report.severity || (report.incident_type === 'SOS' ? 'high' : 'medium')
    });
    return { id: docRef.id, ...report };
  }
  // Fallback to Express backend API
  return await api('/api/reports', { method: 'POST', body: JSON.stringify(report) });
}

// 2. Real-Time Reports Listener (Live Updates on Admin & Responder Maps)
function fbListenReports(onUpdate) {
  if (db) {
    return db.collection('reports')
      .orderBy('created_at', 'desc')
      .limit(50)
      .onSnapshot((snapshot) => {
        const reports = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          reports.push({
            id: doc.id,
            ...data,
            created_at: data.created_at ? data.created_at.toDate().toISOString() : new Date().toISOString()
          });
        });
        onUpdate(reports);
      }, (err) => console.warn('Firestore snapshot error:', err));
  }
  // Fallback: Fetch from API once
  api('/api/reports').then(({ reports }) => onUpdate(reports || [])).catch(() => {});
  return () => {};
}

// 3. Update Incident Status in Firestore
async function fbUpdateReportStatus(id, updateData) {
  if (db) {
    await db.collection('reports').doc(id).update({
      ...updateData,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  }
  return await api(`/api/reports/${id}/status`, { method: 'PUT', body: JSON.stringify(updateData) });
}

// 4. Real-Time Broadcast Alerts Listener
function fbListenAlerts(onUpdate) {
  if (db) {
    return db.collection('alerts')
      .orderBy('created_at', 'desc')
      .limit(20)
      .onSnapshot((snapshot) => {
        const alerts = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          alerts.push({
            id: doc.id,
            ...data,
            created_at: data.created_at ? data.created_at.toDate().toISOString() : new Date().toISOString()
          });
        });
        onUpdate(alerts);
      }, (err) => console.warn('Firestore alerts error:', err));
  }
  api('/api/alerts').then(({ alerts }) => onUpdate(alerts || [])).catch(() => {});
  return () => {};
}

// 5. Broadcast New Emergency Alert
async function fbBroadcastAlert(alert) {
  if (db) {
    const docRef = await db.collection('alerts').add({
      ...alert,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: docRef.id, ...alert };
  }
  return await api('/api/alerts', { method: 'POST', body: JSON.stringify(alert) });
}
