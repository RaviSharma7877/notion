import Link from 'next/link';
import React from 'react';
import { twMerge } from 'tailwind-merge';
import CypressHomeIcon from '../icons/cypressHomeIcon';
import CypressSettingsIcon from '../icons/cypressSettingsIcon';
import CypressTrashIcon from '../icons/cypressTrashIcon';
import Settings from '../settings/settings';
import Trash from '../trash/trash';
import TooltipComponent from '../global/tooltip-component';

interface NativeNavigationProps {
  myWorkspaceId: string;
  className?: string;
  collapsed?: boolean;
}

const NativeNavigation: React.FC<NativeNavigationProps> = ({
  myWorkspaceId,
  className,
  collapsed = false,
}) => {
  const itemClasses = twMerge(
    'group/native flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
    collapsed && 'justify-center px-1'
  );

  const renderWithTooltip = (label: string, node: React.ReactNode) =>
    collapsed ? (
      <TooltipComponent message={label}>{node}</TooltipComponent>
    ) : (
      node
    );

  return (
    <nav className={twMerge('my-2', className)}>
      <ul className="flex flex-col gap-2">
        <li>
          {renderWithTooltip(
            'My workspace',
            <Link className={itemClasses} href={`/dashboard/${myWorkspaceId}`}>
              <CypressHomeIcon />
              {!collapsed && <span>My Workspace</span>}
            </Link>
          )}
        </li>

        <Settings>
          {renderWithTooltip(
            'Settings',
            <li className={twMerge(itemClasses, 'cursor-pointer')}>
              <CypressSettingsIcon />
              {!collapsed && <span>Settings</span>}
            </li>
          )}
        </Settings>

        <Trash>
          {renderWithTooltip(
            'Trash',
            <li className={itemClasses}>
              <CypressTrashIcon />
              {!collapsed && <span>Trash</span>}
            </li>
          )}
        </Trash>
      </ul>
    </nav>
  );
};

export default NativeNavigation;
