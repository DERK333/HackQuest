import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Flame, Trophy, Menu, X, LayoutDashboard, Map, Server, GitBranch, FlaskConical, Zap, Wrench, History, User, ChevronDown, Swords, Brain, Bookmark, MessageSquare, Wand2, BarChart2, ArrowLeft, ScrollText, GraduationCap, Mail, Globe, Plug } from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import Logo from './Logo';

// Root paths — no back button shown on these
const ROOT_PATHS = new Set([
  '/Dashboard', '/Paths', '/Rooms', '/Leaderboard', '/Profile',
  '/SkillTree', '/Sandbox', '/AttackSimulator', '/ScenarioBuilder',
  '/AttackHistory', '/MitreScenarioBuilder', '/QuizEngine', '/SavedQuizzes',
  '/Community', '/CreateDiscussion', '/ContentGenerator', '/Performance', '/AttackLogs', '/CourseProgressTracker',
  '/IndexingMonitor', '/About', '/Contact', '/Connect',
]);

const NAV_ITEMS = [
  { label: 'Dashboard',       path: '/Dashboard',        icon: LayoutDashboard },
  { label: 'Learn',           path: '/Paths',             icon: Map },
  { label: 'Rooms',           path: '/Rooms',             icon: Server },
  { label: 'Skill Tree',      path: '/SkillTree',         icon: GitBranch },
  { label: 'Practice',        children: [
    { label: 'Sandbox',         path: '/Sandbox',           icon: FlaskConical },
    { label: 'Attack Simulator',path: '/AttackSimulator',   icon: Zap },
    { label: 'Scenario Builder',path: '/ScenarioBuilder',   icon: Wrench },
    { label: 'Attack History',  path: '/AttackHistory',     icon: History },
    { label: 'MITRE Builder',   path: '/MitreScenarioBuilder', icon: Swords },
    { label: 'Quiz Engine',     path: '/QuizEngine',            icon: Brain },
    { label: 'Attack Logs',     path: '/AttackLogs',            icon: ScrollText },
  ]},
  { label: 'Saved Spot',      path: '/SavedQuizzes',      icon: Bookmark },
  { label: 'Progress',        path: '/CourseProgressTracker', icon: GraduationCap },
  { label: 'Admin',           path: '/ContentGenerator',  icon: Wand2 },
  { label: 'SEO Monitor',     path: '/IndexingMonitor',   icon: Globe },
  { label: 'Performance',     path: '/Performance',       icon: BarChart2 },
  { label: 'Community',       path: '/Community',         icon: MessageSquare },
  { label: 'Leaderboard',     path: '/Leaderboard',       icon: Trophy },
  { label: 'About',           path: '/About',             icon: Shield },
  { label: 'Contact',         path: '/Contact',           icon: Mail },
  { label: 'Connect AI',      path: '/Connect',           icon: Plug },
];

function DrawerLink({ item, onClose }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (item.children) {
    const isActive = item.children.some(c => location.pathname === c.path);
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
            isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
        >
          {item.label}
          <ChevronDown className={`ml-auto w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="ml-4 mt-1 space-y-1 border-l border-border pl-2">
            {item.children.map(child => (
              <Link
                key={child.path}
                to={child.path}
                onClick={onClose}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  location.pathname === child.path
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <child.icon className="w-4 h-4" />
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = location.pathname === item.path;
  return (
    <Link
      to={item.path}
      onClick={onClose}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
        isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {item.label}
    </Link>
  );
}

export default function TopNav({ user, userPoints, streak }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isRootPath = ROOT_PATHS.has(location.pathname);
  const showBackButton = !isRootPath;

  // Close the drawer when the route changes
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Lock body scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-sidebar/95 backdrop-blur-xl" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
          <div className="flex items-center h-14 gap-3">
            {/* Back button on child screens (mobile) */}
            {showBackButton ? (
              <button
                onClick={() => navigate(-1)}
                aria-label="Go back"
                className="lg:hidden flex items-center justify-center w-9 h-9 min-w-[44px] min-h-[44px] -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : null}

            {/* Slideout toggle */}
            <button
              onClick={() => setDrawerOpen(o => !o)}
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              className="flex items-center justify-center w-9 h-9 min-w-[44px] min-h-[44px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
            >
              {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Logo */}
            <Link
              to="/Dashboard"
              aria-label="HackQuest home"
              className={`flex items-center shrink-0 ${showBackButton ? 'hidden sm:flex' : 'flex'}`}
            >
              <Logo />
            </Link>

            {/* Right side */}
            <div className="ml-auto flex items-center gap-2">
              {/* Search */}
              <GlobalSearch />

              {/* Streak */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-bold text-foreground">{streak || 0}</span>
              </div>

              {/* Points */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30">
                <Trophy className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-primary">{(userPoints || 0).toLocaleString()}</span>
              </div>

              {/* Avatar */}
              <Link to="/Profile" className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center hover:border-primary transition-colors">
                <span className="text-sm font-bold text-primary">
                  {user?.full_name ? user.full_name[0].toUpperCase() : <User className="w-4 h-4" />}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Slideout overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Left slideout navigation */}
      <aside
        aria-hidden={!drawerOpen}
        className={`fixed top-0 left-0 h-full w-72 z-50 bg-sidebar border-r border-border flex flex-col transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-border">
          <Link to="/Dashboard" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2" aria-label="HackQuest home">
            <Logo />
          </Link>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation menu"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <DrawerLink key={item.label} item={item} onClose={() => setDrawerOpen(false)} />
          ))}
        </nav>
      </aside>
    </>
  );
}