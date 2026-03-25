import { useAuth } from "../AuthContext";

export default function AuthButton() {
  const { user, signInWithGoogle, logout } = useAuth();

  return user ? (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img src={user.photoURL} alt="avatar" style={{ borderRadius: "50%", width: 32, height: 32 }} />
      <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>{user.displayName}</span>
      <button onClick={logout} style={{
        fontSize: "0.85rem",
        padding: "6px 14px",
        borderRadius: "6px",
        border: "1px solid var(--border)",
        background: "var(--bg2)",
        color: "var(--text)",
        cursor: "pointer"
      }}>Sign Out</button>
    </div>
  ) : (
    <button onClick={signInWithGoogle} style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 20px",
      borderRadius: "24px",
      border: "1px solid #dadce0",
      background: "#fff",
      color: "#3c4043",
      fontSize: "0.9rem",
      fontWeight: 500,
      fontFamily: "Roboto, sans-serif",
      cursor: "pointer",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
    }}>
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.85l6.09-6.09C34.46 3.08 29.5 1 24 1 14.82 1 7.07 6.48 3.64 14.22l7.08 5.5C12.4 13.36 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.52 24.5c0-1.64-.15-3.22-.42-4.74H24v8.98h12.7c-.55 2.98-2.2 5.5-4.68 7.2l7.18 5.57C43.46 37.78 46.52 31.6 46.52 24.5z"/>
        <path fill="#FBBC05" d="M10.72 28.28A14.6 14.6 0 0 1 9.5 24c0-1.49.26-2.93.72-4.28l-7.08-5.5A23.94 23.94 0 0 0 0 24c0 3.86.92 7.5 2.56 10.72l8.16-6.44z"/>
        <path fill="#34A853" d="M24 47c5.5 0 10.12-1.82 13.5-4.94l-7.18-5.57C28.6 38.4 26.42 39.5 24 39.5c-6.26 0-11.6-3.86-13.28-9.22l-8.16 6.44C6.07 44.52 14.36 47 24 47z"/>
      </svg>
      Sign in with Google
    </button>
  );
}