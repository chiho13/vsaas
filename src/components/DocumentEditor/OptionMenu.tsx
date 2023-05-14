import { motion } from "framer-motion";
import { useTheme } from "styled-components";
import { forwardRef, useRef, useContext } from "react";
import Image from "next/image";
import { MoreHorizontal, Trash2 } from "lucide-react";
import Dropdown, { DropdownProvider } from "../Dropdown";
import { EditorContext } from "@/contexts/EditorContext";
import { ReactEditor } from "slate-react";
import { Transforms } from "slate";

interface OptionMenuProps {
  element: any;
}

export const OptionMenu = forwardRef<HTMLDivElement, OptionMenuProps>(
  ({ element }, ref) => {
    const { editor } = useContext(EditorContext);
    const theme = useTheme();
    const deleteBlock = (event: React.MouseEvent<HTMLButtonElement>) => {
      //   onClick();
      event.preventDefault();
      event.stopPropagation();
      console.log("delete block");
      ReactEditor.focus(editor);

      // Delete the current element
      Transforms.removeNodes(editor, {
        at: ReactEditor.findPath(editor, element),
      });
    };

    const optionMenuRef = useRef(null);

    return (
      <DropdownProvider>
        <Dropdown
          dropdownId="option-menu"
          ref={optionMenuRef}
          usePortal={true}
          dropdownButtonClassName="p-0 border-transparent relative outline-none border-0 shadow-none bg-transparent w-full h-[26px] justify-start transition-colors duration-300 focus:ring-2 focus:ring-black focus:ring-opacity-30 dark:border dark:border-gray-700"
          dropdownMenuClassName="fixed top-0 w-[200px] border-0"
          icon={
            <div className="flex h-[24px] w-[24px] items-center  justify-center rounded-md bg-gray-200 p-1 dark:bg-muted">
              <MoreHorizontal className="option-menu stroke-darkergray dark:stroke-muted-foreground" />
            </div>
          }
        >
          <div className="p-1 " role="none">
            <button
              onClick={deleteBlock}
              className="  flex  w-full items-center rounded-md px-4 py-2 text-left text-sm text-gray-700  hover:bg-gray-100 hover:text-gray-900 dark:text-foreground dark:hover:bg-accent"
              role="menuitem"
              tabIndex={-1}
              id="menu-item-3"
            >
              <Trash2 className="mr-4 w-5  stroke-darkergray dark:stroke-foreground" />
              Delete
            </button>
          </div>
        </Dropdown>
      </DropdownProvider>
    );
  }
);

OptionMenu.displayName = "OptionMenu";
