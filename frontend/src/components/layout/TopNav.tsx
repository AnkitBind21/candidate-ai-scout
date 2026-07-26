import { Bell, Search, Moon, Command } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function TopNav() {
  return (
    <header className="sticky top-0 z-20 h-16 border-b border-border bg-background/60 backdrop-blur-xl">
      <div className="h-full px-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search candidates, jobs, skills…"
            className="w-full h-10 pl-10 pr-16 rounded-xl bg-card/60 border border-border text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/60 border border-border text-[10px] text-muted-foreground">
            <Command className="size-3" /> K
          </kbd>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  disabled
                  className="size-10 grid place-items-center rounded-xl border border-border bg-card/40 text-muted-foreground opacity-60 cursor-not-allowed"
                >
                  <Moon className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Dark mode only</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <button className="relative size-10 grid place-items-center rounded-xl border border-border bg-card/40 hover:bg-card/70 transition-colors">
            <Bell className="size-4" />
            <span className="absolute top-2 right-2 size-2 rounded-full bg-destructive animate-pulse" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 pl-1 pr-3 h-10 rounded-xl border border-border bg-card/40 hover:bg-card/70 transition-colors">
                <Avatar className="size-8">
                  <AvatarImage src="https://api.dicebear.com/9.x/notionists/svg?seed=Alex&backgroundColor=4F46E5" />
                  <AvatarFallback>AC</AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col leading-tight text-left">
                  <span className="text-xs font-semibold">Alex Chen</span>
                  <span className="text-[10px] text-muted-foreground">Admin</span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Team</DropdownMenuItem>
              <DropdownMenuItem>Billing</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Badge className="sr-only">Nav</Badge>
    </header>
  );
}
