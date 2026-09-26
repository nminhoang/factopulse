import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { supabase } from '../../lib/supabase';

interface SessionState {
  /** true once the very first session lookup has finished */
  checked: boolean;
  signedIn: boolean;
  /** undefined = not looked up yet, null = signed in but no company yet */
  companyId: string | null | undefined;
  /** Re-reads which company (if any) this account belongs to. Callers
   *  that change company membership (create/join) should await this
   *  before navigating, so the route guard sees the new value instead
   *  of racing its own background refresh. */
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [companyId, setCompanyId] = useState<string | null | undefined>(undefined);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;

    if (!userId) {
      setCompanyId(undefined);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle();

    setCompanyId(profile?.company_id ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
      if (!session) setCompanyId(undefined);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (signedIn) refreshProfile();
  }, [signedIn, refreshProfile]);

  return (
    <SessionContext.Provider value={{ checked, signedIn, companyId, refreshProfile }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
