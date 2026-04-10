import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Command as CommandPrimitive } from "cmdk";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, Users, UserSquare, Pill, AlertTriangle, Home as HomeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const API = `${import.meta.env.BASE_URL}api`;

interface SearchResults {
  patients: any[];
  staff: any[];
  medications: any[];
  incidents: any[];
  homes: any[];
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        setResults(await res.json());
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (path: string) => {
    setOpen(false);
    setQuery("");
    setResults(null);
    navigate(path);
  };

  const totalResults = results
    ? results.patients.length + results.staff.length + results.medications.length + results.incidents.length + results.homes.length
    : 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search everything...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 max-w-lg">
          <CommandPrimitive shouldFilter={false} className="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2">
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandPrimitive.Input
                placeholder="Search patients, staff, medications, incidents, homes..."
                value={query}
                onValueChange={setQuery}
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <CommandPrimitive.List className="max-h-[400px] overflow-y-auto overflow-x-hidden p-1">
              {loading && (
                <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
              )}

              {!loading && query.length >= 2 && totalResults === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">No results found for "{query}"</div>
              )}

              {!loading && query.length < 2 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Type at least 2 characters to search
                </div>
              )}

              {results && results.patients.length > 0 && (
                <CommandPrimitive.Group heading="🧑‍⚕️ Patients">
                  {results.patients.map((p: any) => (
                    <CommandPrimitive.Item
                      key={`patient-${p.id}`}
                      value={`patient-${p.id}`}
                      onSelect={() => handleSelect(`/patients/${p.id}`)}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <UserSquare className="mr-2 h-4 w-4 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{p.firstName} {p.lastName}</span>
                        {p.homeName && <span className="text-xs text-muted-foreground ml-2">at {p.homeName}</span>}
                      </div>
                      <Badge variant="outline" className="text-xs ml-2">{p.status}</Badge>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}

              {results && results.staff.length > 0 && (
                <CommandPrimitive.Group heading="👥 Staff">
                  {results.staff.map((s: any) => (
                    <CommandPrimitive.Item
                      key={`staff-${s.id}`}
                      value={`staff-${s.id}`}
                      onSelect={() => handleSelect(`/staff`)}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <Users className="mr-2 h-4 w-4 text-green-500" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{s.firstName} {s.lastName}</span>
                        <span className="text-xs text-muted-foreground ml-2">{s.email}</span>
                      </div>
                      <Badge variant="outline" className="text-xs ml-2 capitalize">{s.role}</Badge>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}

              {results && results.medications.length > 0 && (
                <CommandPrimitive.Group heading="💊 Medications">
                  {results.medications.map((m: any) => (
                    <CommandPrimitive.Item
                      key={`med-${m.id}`}
                      value={`med-${m.id}`}
                      onSelect={() => handleSelect(`/medications`)}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <Pill className="mr-2 h-4 w-4 text-purple-500" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{m.name}</span>
                        {m.dosage && <span className="text-xs text-muted-foreground ml-2">{m.dosage}</span>}
                        {m.patientFirstName && (
                          <span className="text-xs text-muted-foreground ml-2">
                            for {m.patientFirstName} {m.patientLastName}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs ml-2">{m.status}</Badge>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}

              {results && results.incidents.length > 0 && (
                <CommandPrimitive.Group heading="⚠️ Incidents">
                  {results.incidents.map((i: any) => (
                    <CommandPrimitive.Item
                      key={`inc-${i.id}`}
                      value={`inc-${i.id}`}
                      onSelect={() => handleSelect(`/incidents/${i.id}`)}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{i.title}</span>
                        {i.homeName && <span className="text-xs text-muted-foreground ml-2">at {i.homeName}</span>}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("text-xs ml-2", i.severity === "critical" && "border-red-300 text-red-600")}
                      >
                        {i.severity}
                      </Badge>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}

              {results && results.homes.length > 0 && (
                <CommandPrimitive.Group heading="🏠 Homes">
                  {results.homes.map((h: any) => (
                    <CommandPrimitive.Item
                      key={`home-${h.id}`}
                      value={`home-${h.id}`}
                      onSelect={() => handleSelect(`/homes/${h.id}`)}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <HomeIcon className="mr-2 h-4 w-4 text-teal-500" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{h.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{h.city}, {h.state}</span>
                      </div>
                      <span className="text-xs text-muted-foreground ml-2">{h.currentOccupancy}/{h.capacity} beds</span>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </DialogContent>
      </Dialog>
    </>
  );
}
