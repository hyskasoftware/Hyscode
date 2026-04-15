import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuShortcut,
} from '../ui/dropdown-menu';
import { useLayoutStore } from '../../stores/layout-store';

export function ViewMenu() {
  const terminalVisible = useLayoutStore((s) => s.terminalVisible);
  const terminalLocation = useLayoutStore((s) => s.terminalLocation);
  const toggleTerminal = useLayoutStore((s) => s.toggleTerminal);
  const moveTerminalToSidebar = useLayoutStore((s) => s.moveTerminalToSidebar);
  const moveTerminalToBottom = useLayoutStore((s) => s.moveTerminalToBottom);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-7 cursor-pointer items-center rounded-md px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none">
        View
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="w-56">
        <DropdownMenuCheckboxItem
          checked={terminalVisible}
          onCheckedChange={toggleTerminal}
        >
          Terminal
          <DropdownMenuShortcut>Ctrl+`</DropdownMenuShortcut>
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={moveTerminalToBottom}
          disabled={terminalLocation === 'bottom'}
        >
          Move Terminal to Panel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={moveTerminalToSidebar}
          disabled={terminalLocation === 'sidebar'}
        >
          Move Terminal to Sidebar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
