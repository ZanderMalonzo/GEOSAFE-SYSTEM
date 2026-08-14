// GeoSafe Firebase Firestore Cloud Integration
// Project: geosafe-9bcdb
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyBnhKtYTQeO-ttzSr15ip5ggzL_a2NKXOQ",
    authDomain: "geosafe-9bcdb.firebaseapp.com",
    databaseURL: "https://geosafe-9bcdb-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "geosafe-9bcdb",
    storageBucket: "geosafe-9bcdb.firebasestorage.app",
    messagingSenderId: "506314338657",
    appId: "1:506314338657:web:7d279c1fc5872f923d5520",
    measurementId: "G-NZW7ZMMR9E"
  };

  let db = null;
  let isInitialized = false;

  // Dynamically load Firebase SDK if not already loaded in the HTML
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function initFirebase() {
    if (isInitialized && db) return db;
    try {
      if (typeof firebase === 'undefined') {
        await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js');
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      isInitialized = true;
      console.log('✅ GeoSafe Firebase Cloud Firestore connected (geosafe-9bcdb)');
      return db;
    } catch (err) {
      console.warn('⚠️ Firebase init warning (running resilient mode):', err);
      return null;
    }
  }

  // Auto-init immediately
  initFirebase();

  // Export Firebase Firestore service globally
  window.GeoSafeDB = {
    getDb: initFirebase,

    // Users: Register in Firestore
    async registerUser(userData) {
      const database = await initFirebase();
      if (!database) return null;
      const emailKey = userData.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const docRef = database.collection('users').doc(emailKey);
      const existing = await docRef.get();
      if (existing.exists) {
        throw new Error('This email is already registered in GeoSafe Cloud.');
      }
      await docRef.set({
        ...userData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return userData;
    },

    // Users: Login from Firestore
    async loginUser(email, password) {
      const database = await initFirebase();
      if (!database) return null;
      const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const docRef = database.collection('users').doc(emailKey);
      const doc = await docRef.get();
      if (!doc.exists) {
        return null; // Not found in Firestore, fallback to local check
      }
      const uData = doc.data();
      if (uData.password && uData.password !== password) {
        throw new Error('Incorrect password. Please verify and try again.');
      }
      const { password: _, ...cleanUser } = uData;
      return cleanUser;
    },

    // Reports: Get all from Firestore
    async getReports() {
      const database = await initFirebase();
      if (!database) return [];
      try {
        const snap = await database.collection('reports').orderBy('created_at', 'desc').limit(50).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch {
        const snap = await database.collection('reports').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    },

    // Reports: Create new Report / SOS
    async createReport(reportData) {
      const database = await initFirebase();
      if (!database) return null;
      const idStr = String(reportData.id || Date.now());
      await database.collection('reports').doc(idStr).set({
        ...reportData,
        id: idStr,
        serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      return reportData;
    },

    // Reports: Update Status
    async updateReport(id, updateData) {
      const database = await initFirebase();
      if (!database) return null;
      const idStr = String(id);
      await database.collection('reports').doc(idStr).update({
        ...updateData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return true;
    },

    // Alerts: Get all Broadcasts
    async getAlerts() {
      const database = await initFirebase();
      if (!database) return [];
      try {
        const snap = await database.collection('alerts').orderBy('created_at', 'desc').limit(20).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch {
        const snap = await database.collection('alerts').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    },

    // Alerts: Broadcast new Alert
    async createAlert(alertData) {
      const database = await initFirebase();
      if (!database) return null;
      const idStr = String(alertData.id || Date.now());
      await database.collection('alerts').doc(idStr).set({
        ...alertData,
        id: idStr,
        serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      return alertData;
    },

    // Family Circles: Get
    async getFamily(circleId = 'default_circle') {
      const database = await initFirebase();
      if (!database) return null;
      try {
        const doc = await database.collection('family_circles').doc(circleId).get();
        return doc.exists ? doc.data() : null;
      } catch (e) {
        return null;
      }
    },

    // Family Circles: Save / Update Entire Circle
    async saveFamily(circleId = 'default_circle', familyData) {
      const database = await initFirebase();
      if (!database) return null;
      await database.collection('family_circles').doc(circleId).set({
        ...familyData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return familyData;
    },

    // Family Circles: Live Real-Time Listener (Life360 Live GPS Sync)
    listenFamily(circleId = 'default_circle', callback) {
      initFirebase().then((database) => {
        if (!database) return;
        database.collection('family_circles').doc(circleId).onSnapshot((doc) => {
          if (doc.exists) {
            callback(doc.data());
          }
        });
      });
    },

    // Real-Time Listeners (Live Push Sync)
    listenAlerts(callback) {
      initFirebase().then((database) => {
        if (!database) return;
        try {
          database.collection('alerts').orderBy('created_at', 'desc').limit(10).onSnapshot((snap) => {
            const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(alerts);
          });
        } catch (e) {
          database.collection('alerts').onSnapshot((snap) => {
            const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(alerts);
          });
        }
      });
    },

    listenReports(callback) {
      initFirebase().then((database) => {
        if (!database) return;
        try {
          database.collection('reports').orderBy('created_at', 'desc').limit(30).onSnapshot((snap) => {
            const reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(reports);
          });
        } catch (e) {
          database.collection('reports').onSnapshot((snap) => {
            const reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(reports);
          });
        }
      });
    }
  };
})();
