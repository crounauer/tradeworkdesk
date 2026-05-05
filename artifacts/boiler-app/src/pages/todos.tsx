import { useState, useEffect, useRef } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Square, Trash2, Plus, Loader2, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
}

const BASE = import.meta.env.BASE_URL;

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    (async () => {
      try {
        const data = await customFetch(`${BASE}api/todos`) as Todo[];
        setTodos(data);
      } catch {
        toast({ title: "Error", description: "Failed to load to-do list", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      const created = await customFetch(`${BASE}api/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }) as Todo;
      setTodos(prev => [created, ...prev]);
      setNewTitle("");
      inputRef.current?.focus();
      qc.invalidateQueries({ queryKey: ["me-init"] });
    } catch {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (todo: Todo) => {
    // Optimistic update
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t));
    try {
      await customFetch(`${BASE}api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !todo.completed }),
      });
      qc.invalidateQueries({ queryKey: ["me-init"] });
    } catch {
      // Revert on error
      setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: todo.completed } : t));
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    try {
      await customFetch(`${BASE}api/todos/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["me-init"] });
    } catch {
      // Reload to restore state on error
      try {
        const data = await customFetch(`${BASE}api/todos`) as Todo[];
        setTodos(data);
      } catch { /* ignore */ }
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  };

  const active = todos.filter(t => !t.completed);
  const completed = todos.filter(t => t.completed);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">My To-Do List</h1>
      </div>

      {/* Add form */}
      <Card className="p-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            ref={inputRef}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Add a new task..."
            disabled={adding}
            className="flex-1"
            maxLength={500}
          />
          <Button type="submit" disabled={adding || newTitle.trim().length === 0} className="gap-1.5 shrink-0">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </Button>
        </form>
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && todos.length === 0 && (
        <Card className="p-10 text-center space-y-2">
          <CheckSquare className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground font-medium">Nothing here yet</p>
          <p className="text-sm text-muted-foreground">Add your first task above to get started.</p>
        </Card>
      )}

      {/* Active items */}
      {!loading && active.length > 0 && (
        <Card className="divide-y divide-border/50">
          {active.map(todo => (
            <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </Card>
      )}

      {/* Completed items */}
      {!loading && completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            Completed ({completed.length})
          </p>
          <Card className="divide-y divide-border/50">
            {completed.map(todo => (
              <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

function TodoItem({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 group">
      <button
        onClick={() => onToggle(todo)}
        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
        aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
      >
        {todo.completed
          ? <CheckSquare className="w-5 h-5 text-emerald-500" />
          : <Square className="w-5 h-5" />
        }
      </button>
      <span className={cn(
        "flex-1 text-sm",
        todo.completed && "line-through text-muted-foreground"
      )}>
        {todo.title}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Delete task"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
