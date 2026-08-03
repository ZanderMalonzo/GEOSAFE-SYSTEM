from pathlib import Path

p = Path(r"C:\Users\zander\OneDrive\ZanderIT\OneDrive\IT\GEOSAFE SYSTEM\geosafe\resident-ui\src\app\App.tsx")
text = p.read_text(encoding="utf-8")

# --- Login ---
old = '''function LoginScreen({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const [email, setEmail] = useState("juan.delacruz@bayanan.gov.ph");
  const [password, setPassword] = useState("••••••••");
  const [remember, setRemember] = useState(false);

  return ('''

new = '''function LoginScreen({ onLogin, onRegister }: { onLogin: (user: GeosafeUser) => void; onRegister: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await apiLogin(email.trim(), password);
      if (data.user.role === "admin" || data.user.role === "responder") {
        window.location.href = roleHome(data.user.role);
        return;
      }
      onLogin(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return ('''

if old not in text:
    raise SystemExit("LoginScreen start not found")
text = text.replace(old, new, 1)

old_btn = '''        <button
          onClick={onLogin}
          className="w-full py-4 rounded-2xl font-semibold text-white text-base transition-transform active:scale-[0.98]"
          style={{ backgroundColor: BLUE }}
        >
          LOGIN
        </button>'''

new_btn = '''        {error && (
          <div className="text-sm rounded-xl px-3 py-2" style={{ backgroundColor: RED + "15", color: RED }}>{error}</div>
        )}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-semibold text-white text-base transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ backgroundColor: BLUE, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? <Loader size={18} className="animate-spin" /> : null}
          {loading ? "Signing in..." : "LOGIN"}
        </button>'''

if old_btn not in text:
    raise SystemExit("Login button not found")
text = text.replace(old_btn, new_btn, 1)

# --- Register ---
old_reg = '''  const handleRegister = () => {
    if (!agreed) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onDone();
    }, 1400);
  };'''

new_reg = '''  const [error, setError] = useState("");
  const handleRegister = async () => {
    if (!agreed) return;
    if (!form.fullName || !form.email || !form.password) {
      setError("Name, email, and password are required");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await apiRegister(form.fullName, form.email, form.password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };'''

if old_reg not in text:
    raise SystemExit("handleRegister not found")
text = text.replace(old_reg, new_reg, 1)

# Add error display before register button if missing - inject near Register button disabled
old_reg_btn = '''          <button
            onClick={handleRegister}
            disabled={!agreed || loading}
            className="w-full py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-opacity"
            style={{ backgroundColor: BLUE, opacity: !agreed || loading ? 0.6 : 1 }}
          >
            {loading ? <Loader size={18} className="animate-spin" /> : null}
            {loading ? "Creating Account..." : "Register"}
          </button>'''

new_reg_btn = '''          {error && (
            <div className="text-sm rounded-xl px-3 py-2 mb-2" style={{ backgroundColor: RED + "15", color: RED }}>{error}</div>
          )}
          <button
            onClick={handleRegister}
            disabled={!agreed || loading}
            className="w-full py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-opacity"
            style={{ backgroundColor: BLUE, opacity: !agreed || loading ? 0.6 : 1 }}
          >
            {loading ? <Loader size={18} className="animate-spin" /> : null}
            {loading ? "Creating Account..." : "Register"}
          </button>'''

if old_reg_btn not in text:
    raise SystemExit("Register button not found")
text = text.replace(old_reg_btn, new_reg_btn, 1)

# --- Report submit ---
old_report = '''  const handleSubmit = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 1500);
  };'''

new_report = '''  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locLabel, setLocLabel] = useState("Tap refresh to capture GPS");
  const [error, setError] = useState("");
  const [refId, setRefId] = useState<number | null>(null);

  const refreshGps = async () => {
    setLocLabel("Acquiring location...");
    try {
      const pos = await getGeolocation();
      setCoords(pos);
      setLocLabel(`${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`);
    } catch (err) {
      setLocLabel(err instanceof Error ? err.message : "GPS unavailable");
    }
  };

  useEffect(() => { refreshGps(); }, []);

  const handleSubmit = async () => {
    setError("");
    if (desc.trim().length < 10) {
      setError("Description must be at least 10 characters");
      return;
    }
    setLoading(true);
    try {
      const pos = coords || await getGeolocation();
      const data = await submitReport({
        incident_type: incidentType,
        description: desc.trim(),
        latitude: pos.latitude,
        longitude: pos.longitude,
      });
      setRefId(data.report.id);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  };'''

if old_report not in text:
    raise SystemExit("Report handleSubmit not found")
text = text.replace(old_report, new_report, 1)

# Update reference number display
text = text.replace(
    '<span className="font-bold text-sm" style={{ color: "#212121" }}>#GS-2024-07423</span>',
    '<span className="font-bold text-sm" style={{ color: "#212121" }}>#{refId ?? "—"}</span>',
    1,
)

# Update GPS display in report
old_gps = '''          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#F7F9FC", border: "1px solid #E0E0E0" }}>
            <MapPin size={18} color={BLUE} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "#212121" }}>Bayanan, Muntinlupa City</p>
              <p className="text-xs" style={{ color: "#9E9E9E" }}>14.3972° N, 121.0200° E</p>
            </div>
            <button className="p-2 rounded-lg" style={{ backgroundColor: "#E3F0FF" }}>
              <RefreshCw size={14} color={BLUE} />
            </button>
          </div>'''

new_gps = '''          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#F7F9FC", border: "1px solid #E0E0E0" }}>
            <MapPin size={18} color={BLUE} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "#212121" }}>Current GPS</p>
              <p className="text-xs" style={{ color: "#9E9E9E" }}>{locLabel}</p>
            </div>
            <button type="button" onClick={refreshGps} className="p-2 rounded-lg" style={{ backgroundColor: "#E3F0FF" }}>
              <RefreshCw size={14} color={BLUE} />
            </button>
          </div>
          {error && <p className="text-xs mt-2" style={{ color: RED }}>{error}</p>}'''

if old_gps not in text:
    raise SystemExit("GPS block not found")
text = text.replace(old_gps, new_gps, 1)

p.write_text(text, encoding="utf-8")
print("Part 1 OK")
