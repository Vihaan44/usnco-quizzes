import { useAuth } from "../AuthContext";

export default function AuthButton() {
  const { user, signInWithGoogle, logout } = useAuth();

  return user ? (
    <div>
      <img src={user.photoURL} alt="avatar" style={{ borderRadius: "50%", width: 32 }} />
      <span>{user.displayName}</span>
      <button onClick={logout}>Sign Out</button>
    </div>
  ) : (
    <button onClick={signInWithGoogle}>Sign in with Google</button>
  );
}