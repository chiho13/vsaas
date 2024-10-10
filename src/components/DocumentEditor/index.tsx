import React, {
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
  useContext,
  createContext,
  useLayoutEffect,
  memo,
} from "react";
import {
  Element as SlateElement,
  createEditor,
  Editor,
  Transforms,
  Path,
  BaseEditor,
  Range,
  Node,
  Element,
  Location,
  Text,
  Point,
  Descendant,
} from "slate";

import { ImageEmbedLink } from "./EditorElements/ImageElement";
import scrollIntoView from "scroll-into-view-if-needed";
import { isEqual } from "lodash";
import { EditorContext, SlateEditorContext } from "@/contexts/EditorContext";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { Crown, Plus, Sidebar, Zap } from "lucide-react";
import {
  VscLayoutSidebarRightOff,
  VscLayoutSidebarRight,
} from "react-icons/vsc";
import "katex/dist/katex.min.css";
import "katex/dist/contrib/mhchem.min.js";
import { AnimatePresence, motion } from "framer-motion";

import styled, { useTheme } from "styled-components";
import useClickOutside from "@/hooks/useClickOutside";

import { LayoutContext } from "../Layouts/AccountLayout";
import { y_animation_props } from "../Dropdown";

import { findElementInSlateValue } from "./helpers/findElementInSlate";
import { MathQuestionGenerator } from "../QuestionGenerator/Math";
import { useRouter } from "next/router";
import { Portal } from "react-portal";
import { Toolbar } from "@/components/Toolbar";
import { up_animation_props } from "@/config/framer";

import { slightbouncey } from "@/config/framer";
import {
  toggleBlock,
  toggleFormat,
  isParentTTS,
  insertNewParagraph,
  getActiveLinkUrl,
} from "./helpers/toggleBlock";

import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDndMonitor,
} from "@dnd-kit/core";

import { genNodeId } from "@/hoc/withID";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { ActiveElementProvider } from "@/contexts/ActiveElementContext";
import { SortableElement } from "./SortableElement";
import { ElementSelector, EmbedLink } from "./EditorElements";
import { DragOverlayContent } from "./DragOverlayContent";
import { RightSideBar } from "@/components/RightSidebar";

import { findAncestorWithClass } from "../../utils/findAncestors";

import { useNewColumn } from "@/contexts/NewColumnContext";
import { useSensor, useSensors, MouseSensor } from "@dnd-kit/core";
import { findPathById, createColumns } from "./helpers/createColumns";
import { FloatingModal } from "@/components/FloatingModal";
import { Leaf } from "./LeafElements/TextLeaf";
import { MiniDropdown } from "./MiniDropdown";
import { OptionMenu } from "./OptionMenu";
import { useTextSpeech } from "../../contexts/TextSpeechContext";
import { textRegex } from "./helpers/textRegex";
import { addMCQBlock } from "./helpers/addMCQBlock";
import { breakpoints } from "@/utils/breakpoints";
import { useLocalStorage } from "usehooks-ts";
import { HOTKEYS } from "@/config/hotkeys";
import isHotkey from "is-hotkey";

import Upgrade from "@/components/Upgrade";
import { SelectDataVis } from "./EditorElements";

interface DocumentEditorProps {
  workspaceId: string;
  credits: Number;
  handleTextChange?: (value: any) => void;
  initialSlateValue?: any;
  setFetchWorkspaceIsLoading: (value: any) => void;
}

export type CustomElement = {
  id?: string;
  type: string;
  children: any[];
  altText?: string;
  align?: string;
  uploading?: boolean;
  listNumber?: number;
  correctAnswer?: boolean;
  questionNumber?: number;
  voice_id?: string;
  checked?: boolean;
  name?: string;
  accent?: string;
  content?: string;
  liveContent?: string;
  audio_url?: string;
  audioplayer?: boolean;
  file_name?: string;
  loading?: boolean;
  transcript?: Object;
  latex?: string; // Add this line for the latex string
  slideNumber?: Number;
  latLng?: any;
  placeName?: string;
  address?: string;
  zoom?: Number;
  url?: string | undefined;
  width?: any;
  height?: any;
  audioPoint?: any;
  activeId?: any;
  embedLink?: any;
  data?: any;
};

type CustomText = {
  url?: string | undefined;
  highlighted?: any;
  link?: any;
  highlight?: any;
  blank?: any;
  strikethrough?: any;
  underline?: any;
  italic?: any;
  bold?: any;
  text?: string;
};

interface CustomNode {
  latex?: string;
  id?: string; // if 'id' is also not defined on Node
}

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

const StyledMiniToolbar = styled(motion.div)`
  position: absolute;
  z-index: 20;
  display: block;
`;

import { EditBlockPopup } from "../EditEquationBlock";
import { EnglishQuestionGenerator } from "../QuestionGenerator/English";
import { addEditableEquationBlock } from "./helpers/addEquationBlock";
import useResizeSidebar from "@/hooks/useResizeSidebar";
import { debounce } from "lodash";
import { cn } from "@/utils/cn";
import { splitIntoSlides } from "@/utils/renderHelpers";
import { syncStatusStore } from "@/store/sync";

export const DocumentEditor: React.FC<DocumentEditorProps> = memo(
  ({
    workspaceId,
    credits,
    handleTextChange,
    initialSlateValue,
    setFetchWorkspaceIsLoading,
  }) => {
    const theme = useTheme();
    const router = useRouter();

    const { upgrade, ...rest } = router.query;
    const { isLocked } = useContext(LayoutContext);

    const sideBarOffset = isLocked ? 240 : 0;

    const { syncStatus } = syncStatusStore();

    const {
      showEditBlockPopup,
      setShowEditBlockPopup,
      activePath,
      setActivePath,
      selectedElementID,
      setSelectedElementID,
      lastActiveSelection,
      setLastActiveSelection,
    } = useContext(EditorContext);

    const { editor } = useContext(SlateEditorContext);

    const [slatevalue, setValue] = useState(initialSlateValue);
    const [ghostslatevalue, setGhostValue] = useState(initialSlateValue);

    const debouncedSetSlateValue = useCallback(
      debounce((value) => {
        // setSyncStatus("syncing");
        // setValue(value);
        handleTextChange(value);
      }, 600),
      []
    );

    const [currentSlateKey, setCurrentSlateKey] = useState(workspaceId);
    const [activeId, setActiveId] = useState(null);

    const activeIndex = activeId
      ? slatevalue.findIndex((el: { id: any }) => el.id === activeId)
      : -1;

    const [showDropdown, setShowDropdown] = useState(false);

    const sensors = useSensors(useSensor(MouseSensor));

    const [dropdownPositions, setDropdownPositions] = useState<
      Map<string, { top: number; left: number }>
    >(new Map());

    const [activeEditEquationPath, setactiveEditEquationPath] = useState<
      string | null
    >(null);

    const addSomethingDropdownRef = useRef<HTMLDivElement | null>(null);
    const editBlockDropdownRef = useRef<HTMLDivElement | null>(null);

    const [dropdownTop, setDropdownTop] = useState<number>(0);
    const [dropdownLeft, setDropdownLeft] = useState<number>(0);

    const [openUpgrade, setOpenUpgrade] = useState(false);

    const [dropdownEditBlockTop, setDropdownEditBlockTop] = useState<
      number | null
    >(0);
    const [dropdownEditBlockLeft, setDropdownEditBlockLeft] = useState<
      number | null
    >(0);

    const {
      creatingNewColumn,
      setCreatingNewColumn,
      insertDirection,
      setInsertDirection,
    } = useNewColumn();

    const [showFloatingModal, setShowFloatingModal] = useState({
      open: false,
      subject: "",
    });

    const [miniToolbarPosition, setMiniToolbarPosition] = useState({
      x: 0,
      y: 0,
    });

    const [searchMinidropdownText, setSearchMinidropdownText] = useState<
      string | null
    >(null);

    const [usingCommandLine, setusingCommandLine] = useState(false);

    const [showMiniToolbar, setShowMiniToolbar] = useState(false);

    const generateKey = () => {
      const timestamp = new Date().getTime();
      const randomNumber = Math.floor(Math.random() * 1000);
      return `slate-key-${timestamp}-${randomNumber}`;
    };

    useEffect(() => {
      setValue(initialSlateValue);
      setFetchWorkspaceIsLoading(false);
      // setGhostValue(initialSlateValue);
      setCurrentSlateKey(generateKey());
    }, [initialSlateValue, workspaceId]);

    const [searchBarPosition, setSearchBarPosition] = useState(false);

    const nodeIsEmpty = (currentNode: { children: string | any[] }) => {
      if (
        currentNode.children.length === 1 &&
        currentNode.children[0].text === ""
      ) {
        return true;
      }

      // Iterate over all children nodes
      for (const child of currentNode.children) {
        // Check for different element types
        if (child.type === "equation" || child.type === "mcq") {
          return false;
        }
      }

      return true;
    };

    const [forceUpdate, setForceUpdate] = useState(false);

    const openMiniDropdown = useCallback(
      (path: Path) => {
        const currentpathString = JSON.stringify(path);

        console.log(path);
        setActivePath(currentpathString);
        const currentElement = document.querySelector(
          `[data-path="${JSON.stringify(path)}"]`
        );
        if (!currentElement) return;
        const targetRect = currentElement.getBoundingClientRect();

        console.log(currentElement);
        const windowHeight = window.innerHeight;
        const dropdownHeight = 370;
        console.log(dropdownHeight);
        const spaceBelowTarget = windowHeight - targetRect.bottom;

        const currentNode = Node.get(editor, path);

        const isEmpty =
          SlateElement.isElement(currentNode) &&
          currentNode.children.length === 1 &&
          currentNode.children[0].text === "" &&
          currentNode.type !== "equation" &&
          currentNode.type !== "mcq" &&
          currentNode.type !== "image" &&
          currentNode.type !== "datavis" &&
          currentNode.type !== "embed" &&
          currentNode.type !== "slide";
        console.log(targetRect.height);
        if (!isEmpty) {
          insertNewParagraph(editor, Path.next(path));
          setActivePath(JSON.stringify(Path.next(path)));
          setForceUpdate((prev) => !prev);
        }
        console.log(isEmpty);
        let topOffset = isEmpty ? 15 : 45;

        let showDropdownAbove = false;

        if (spaceBelowTarget < dropdownHeight) {
          topOffset = -(
            dropdownHeight -
            targetRect.height +
            (isEmpty ? -40 : -80)
          );
          showDropdownAbove = true;
        }
        setSearchBarPosition(spaceBelowTarget < dropdownHeight);

        setDropdownTop(
          showDropdownAbove
            ? targetRect.top + topOffset
            : targetRect.bottom + topOffset
        );
        setDropdownLeft(targetRect.left - 10);
        setShowDropdown((prevState) => !prevState);
      },
      [dropdownPositions, isLocked, showDropdown, activePath, forceUpdate]
    );

    function splitTitleNode(newPath: Path) {
      Transforms.splitNodes(editor);
      Transforms.setNodes(
        editor,
        { id: genNodeId(), type: "paragraph", align: "start" },
        { at: newPath }
      );
    }

    const insertNewNode = (editor, parentPath, nodeType, node) => {
      const newPath = Path.next(parentPath);

      const currentAlign = node?.align || "start"; // use some default alignment if there is no previous node or it has no alignment

      const newNode = {
        id: genNodeId(),
        type: nodeType,
        align: currentAlign, // apply the alignment of the previous node to the new node
        children: [{ text: "" }],
      };

      Transforms.insertNodes(editor, newNode, { at: newPath });
      Transforms.select(editor, newPath);
    };

    const splitNodeAndSetNewId = (editor, newPath) => {
      Transforms.splitNodes(editor);
      const newId = genNodeId();
      Transforms.setNodes(editor, { id: newId }, { at: newPath });
      Transforms.select(editor, Editor.start(editor, newPath));
    };

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        const { selection } = editor;

        if (!selection || !ReactEditor.isFocused(editor)) {
          return;
        }

        for (const hotkey in HOTKEYS) {
          if (isHotkey(hotkey, event as any)) {
            event.preventDefault();
            const mark = HOTKEYS[hotkey] as string;
            toggleFormat(editor, mark);
          }
        }

        const [parentNode, parentPath] = Editor.parent(
          editor,
          selection.anchor.path
        );

        const _currentNodePath = selection.anchor.path.slice(0, -1);

        // setActivePath(JSON.stringify(selection.anchor.path));
        const startPosition = selection.anchor;
        const [currentNode, currentNodePath] = Editor.parent(
          editor,
          startPosition.path
        );

        let updatedNode: any = null;

        const isEmpty = currentNode.children[0].text === "";

        const startOfNode = Editor.start(editor, editor.selection);
        const cursorAtStartOfNode =
          Range.isCollapsed(editor.selection) &&
          Point.equals(editor.selection.anchor, startOfNode);
        if (event.nativeEvent.key === "/" && isEmpty && cursorAtStartOfNode) {
          event.preventDefault();
          openMiniDropdown(_currentNodePath);
          setusingCommandLine(true);
        }

        if (/^[a-zA-Z0-9-_]$/.test(event.key)) {
          const currentNode = Editor.node(editor, _currentNodePath);
          const currentText = Node.string(currentNode[0]);

          const slashIndex = currentText.lastIndexOf("/");
          if (slashIndex !== -1) {
            // Extract the text after the last "/" in the currentText
            const searchText = currentText.slice(slashIndex + 1) + event.key;
            console.log(searchText);
            setSearchMinidropdownText(searchText);
          } else {
            setSearchMinidropdownText(null);
          }
        } else {
          setSearchMinidropdownText(null);
        }

        if (event.key === " ") {
          const currentNode = Editor.node(editor, _currentNodePath);
          const currentText = Node.string(currentNode[0]);

          const slashIndex = currentText.lastIndexOf("-");
          if (currentText.startsWith("-")) {
            // Get the current selection in the editor
            const { selection } = editor;

            if (selection) {
              if (
                SlateElement.isElement(parentNode) &&
                (parentNode.type === "paragraph" ||
                  parentNode.type === "heading-one" ||
                  parentNode.type === "heading-two" ||
                  parentNode.type === "heading-three")
              ) {
                toggleBlock(editor, "bulleted-list");
                Transforms.delete(editor, { unit: "character", reverse: true });
              }
            }
          } else if (currentText.startsWith("1.")) {
            const { selection } = editor;
            if (selection) {
              if (
                SlateElement.isElement(parentNode) &&
                (parentNode.type === "paragraph" ||
                  parentNode.type === "heading-one" ||
                  parentNode.type === "heading-two" ||
                  parentNode.type === "heading-three")
              ) {
                toggleBlock(editor, "numbered-list");
                Transforms.delete(editor, {
                  unit: "character",
                  distance: 2,
                  reverse: true,
                });
              }
            }
          } else if (currentText.startsWith("[]")) {
            const { selection } = editor;
            if (selection) {
              event.preventDefault();
              if (
                SlateElement.isElement(parentNode) &&
                (parentNode.type === "paragraph" ||
                  parentNode.type === "heading-one" ||
                  parentNode.type === "heading-two" ||
                  parentNode.type === "heading-three")
              ) {
                toggleBlock(editor, "checked-list");
                Transforms.delete(editor, {
                  unit: "character",
                  distance: 2,
                  reverse: true,
                });
              }
            }
          }
        }

        if (event.key === "Enter") {
          event.preventDefault();

          if (SlateElement.isElement(parentNode) && selection) {
            if (
              [
                "numbered-list",
                "bulleted-list",
                "checked-list",
                "option-list-item",
                "block-quote",
              ].includes(parentNode.type)
            ) {
              const newPath = Path.next(parentPath);
              const currentAlign = parentNode?.align || "start";
              if (
                currentNode.children.every((child) => {
                  return Text.isText(child) && child.text === "";
                })
              ) {
                event.preventDefault();
                Transforms.setNodes(
                  editor,
                  { type: "paragraph", align: currentAlign },
                  { at: _currentNodePath }
                );

                Transforms.select(
                  editor,
                  Editor.start(editor, _currentNodePath)
                );
                return;
              }

              if (Editor.isEnd(editor, selection.anchor, _currentNodePath)) {
                if (parentNode.type === "block-quote") {
                  if (event.shiftKey) {
                    console.log("Shift key pressed:", event.shiftKey);
                    editor.insertText("\n");
                    return;
                  } else {
                    insertNewNode(editor, parentPath, "paragraph", parentNode);
                  }
                } else {
                  insertNewNode(
                    editor,
                    parentPath,
                    parentNode.type,
                    parentNode
                  );
                }
              }

              if (
                Editor.isStart(
                  editor,
                  editor.selection.anchor,
                  _currentNodePath
                )
              ) {
                insertNewNode(
                  editor,
                  _currentNodePath,
                  parentNode.type,
                  parentNode
                );
              } else {
                splitNodeAndSetNewId(editor, newPath);
              }
            }

            if (
              parentNode.type === "paragraph" ||
              parentNode.type === "heading-one" ||
              parentNode.type === "heading-two" ||
              parentNode.type === "heading-three"
            ) {
              const newPath = Path.next(parentPath);
              const parentAlign = parentNode.align || "start";
              if (Editor.isEnd(editor, selection.anchor, _currentNodePath)) {
                // insertNewParagraph(newPath);
                const newPath = Path.next(parentPath);
                Transforms.insertNodes(
                  editor,
                  {
                    id: genNodeId(),
                    type: "paragraph",
                    align: parentAlign,
                    children: [{ text: "" }],
                  },
                  { at: newPath }
                );
                Transforms.select(editor, newPath);
              }

              console.log(_currentNodePath);

              if (
                Editor.isStart(
                  editor,
                  editor.selection.anchor,
                  _currentNodePath
                )
              ) {
                // Get the previous path for the new paragraph
                // Create a new paragraph with an empty text node and a new ID
                const newParagraph = {
                  type: "paragraph",
                  align: parentAlign,
                  id: genNodeId(),
                  children: [{ text: "" }],
                };

                // Insert the new paragraph at the previous path
                Transforms.insertNodes(editor, newParagraph, {
                  at: _currentNodePath,
                });
              } else {
                if (parentNode.type !== "paragraph") {
                  splitTitleNode(Path.next(_currentNodePath));
                } else {
                  Transforms.splitNodes(editor);
                }

                const newId = genNodeId();
                Transforms.setNodes(editor, { id: newId }, { at: newPath });
                Transforms.select(editor, Editor.start(editor, newPath));
              }
            }

            if (parentNode.type === "title") {
              event.preventDefault();
              const nextNode = Editor.next(editor, { at: parentPath });

              if (
                !nextNode ||
                (nextNode &&
                  SlateElement.isElement(nextNode[0]) &&
                  nextNode[0].type !== "mcq" &&
                  nextNode[0].type !== "equation")
              ) {
                if (
                  Editor.isStart(
                    editor,
                    editor.selection.anchor,
                    _currentNodePath
                  )
                ) {
                  const newPath = Path.next(parentPath);
                  // Insert an empty paragraph below the title
                  Transforms.insertNodes(
                    editor,
                    {
                      id: genNodeId(),
                      type: "paragraph",
                      align: "start",
                      children: [{ text: "" }],
                    },
                    { at: newPath }
                  );
                  // Move the content of the title to the new paragraph
                  Transforms.moveNodes(editor, {
                    at: [0, 0],
                    to: [1, 0],
                  });
                  // Set the title node to empty
                  // Transforms.insertText(editor, "", { at: [0, 0], select: true });
                  // Transforms.setNodes(editor, { type: "title" }, { at: [0] });
                }

                if (Editor.isEnd(editor, selection.anchor, _currentNodePath)) {
                  const newPath = Path.next(parentPath);
                  Transforms.insertNodes(
                    editor,
                    {
                      id: genNodeId(),
                      type: "paragraph",
                      align: "start",
                      children: [{ text: "" }],
                    },
                    { at: newPath }
                  );
                  Transforms.select(editor, newPath);
                } else {
                  const newPath = Path.next(parentPath);
                  splitTitleNode(newPath);
                }
              } else {
                // Otherwise, split the nodes and create a new paragraph as before

                if (Editor.isEnd(editor, selection.anchor, _currentNodePath)) {
                  const newPath = Path.next(parentPath);
                  insertNewParagraph(editor, newPath);
                } else {
                  splitTitleNode(parentPath);
                }
              }
            }

            // if (parentNode.type === "option-list-item") {
            //   const newPath = Path.next(parentPath);
            //   const newNode = {
            //     id: genNodeId(),
            //     type: "option-list-item",
            //     children: [{ text: "" }],
            //     correctAnswer: false,
            //   };
            //   Transforms.insertNodes(editor, newNode, { at: newPath });
            //   Transforms.select(editor, Editor.start(editor, newPath));
            //   updatedNode = newNode;
            // }
          }
        }

        if (event.key === "Backspace") {
          const { selection } = editor;

          if (selection && Range.isCollapsed(selection)) {
            // Do nothing if there is a range selected

            // Get the node before the current selection

            // If the node before the selection is a paragraph, merge the nodes

            const currentNode = Node.get(editor, _currentNodePath);
            const _stringcurrentNode = Editor.node(editor, _currentNodePath);
            const currentText = Node.string(_stringcurrentNode[0]);
            const currentParagraph = Editor.node(editor, _currentNodePath);
            const parentNode = Editor.parent(editor, _currentNodePath);
            // Check if currentNode is an equation

            if (
              SlateElement.isElement(currentNode) &&
              [
                "numbered-list",
                "bulleted-list",
                "checked-list",
                "option-list-item",
                "block-quote",
              ].includes(currentNode.type)
            ) {
              let newProperties = {
                type: "paragraph",
                align: "start",
              };

              const backToParagraph =
                currentNode.children.every((child) => {
                  return Text.isText(child) && child.text === "";
                }) &&
                Editor.isStart(
                  editor,
                  editor.selection.anchor,
                  _currentNodePath
                );

              if (backToParagraph) {
                event.preventDefault();
                // Transforms.setNodes(editor, newProperties);
                toggleBlock(editor, "paragraph");
              }
            }

            // Check if the current node is a paragraph and the cursor is at the start

            if (
              SlateElement.isElement(currentNode) &&
              currentNode.type === "paragraph"
            ) {
              const prevNodeEntry = Editor.previous(editor, {
                at: _currentNodePath,
              });

              if (prevNodeEntry) {
                const [_prevNode] = prevNodeEntry;

                const isStart = Editor.isStart(
                  editor,
                  selection.anchor,
                  _currentNodePath
                );

                if (
                  SlateElement.isElement(_prevNode) &&
                  ((_prevNode.type === "mcq" && isStart) ||
                    (_prevNode.type === "slide" && isStart))
                ) {
                  event.preventDefault();
                  const nextParagraph = Editor.previous(editor, {
                    at: _currentNodePath,
                    match: (n) =>
                      SlateElement.isElement(n) && n.type === "paragraph",
                  });

                  if (nextParagraph) {
                    const [nextNode, nextPath] = nextParagraph;
                    const targetPosition = Editor.end(editor, nextPath);
                    Transforms.select(editor, targetPosition);
                  }
                }

                if (
                  Node.string(_prevNode) === "" &&
                  SlateElement.isElement(_prevNode) &&
                  _prevNode.type !== "paragraph" &&
                  isStart
                ) {
                  event.preventDefault();
                  const heading = Editor.previous(editor, {
                    at: _currentNodePath,
                  });

                  if (heading) {
                    const [nextNode, nextPath] = heading;
                    const targetPosition = Editor.end(editor, nextPath);
                    Transforms.select(editor, targetPosition);
                  }
                }
              }
            }

            // if (currentNode.type === "equation" || currentNode.type === "audio") {
            //   event.preventDefault();
            // } else {
            //   // Check if the previous node is an equation
            //   const prevNodeEntry = Editor.previous(editor, {
            //     at: _currentNodePath,
            //   });

            //   if (prevNodeEntry) {
            //     const [_prevNode] = prevNodeEntry;

            //     if (
            //       (_prevNode.type === "equation" || _prevNode.type === "audio") &&
            //       Editor.isStart(editor, selection.anchor, _currentNodePath)
            //     ) {
            //       event.preventDefault();
            //       const nextParagraph = Editor.previous(editor, {
            //         at: currentParagraph[1],
            //         match: (n) => n.type === "paragraph",
            //       });
            //       if (nextParagraph) {
            //         const [nextNode, nextPath] = nextParagraph;
            //         const targetPosition = Editor.end(editor, nextPath);
            //         Transforms.select(editor, targetPosition);
            //       }
            //     }
            //   }
            // }

            if (
              SlateElement.isElement(currentNode) &&
              currentNode.type === "list-item"
            ) {
              const parentNode = Editor.parent(editor, currentNodePath);
              if (
                SlateElement.isElement(parentNode[0]) &&
                parentNode[0].type === "mcq"
              ) {
                // Check if the list-item text is empty
                const isEmpty =
                  currentNode.children.length === 1 &&
                  currentNode.children[0].text === "";
                if (isEmpty) {
                  event.preventDefault();
                }
              }
            }

            if (
              ((SlateElement.isElement(currentNode) &&
                currentNode.type === "option-list-item") ||
                updatedNode) &&
              SlateElement.isElement(parentNode[0]) &&
              parentNode[0].type === "mcq"
            ) {
              const optionListItems = parentNode[0].children.filter(
                (child) => child.type === "option-list-item"
              );

              if (optionListItems.length <= 2) {
                const isEmpty =
                  (SlateElement.isElement(currentNode) &&
                    currentNode.children.length === 1 &&
                    currentNode.children[0].text === "") ||
                  (updatedNode && updatedNode.children[0].text === "");
                if (isEmpty) {
                  event.preventDefault();
                }
              }
            }

            if (
              SlateElement.isElement(currentNode) &&
              currentNode.type === "question-item"
            ) {
              const isFirstQuestionItem =
                parentNode[0].children[0] === currentNode;
              if (
                isFirstQuestionItem &&
                Editor.isStart(
                  editor,
                  editor.selection.anchor,
                  _currentNodePath
                )
              ) {
                event.preventDefault();
              }
            }

            if (
              SlateElement.isElement(currentNode) &&
              currentNode.type === "option-list-item"
            ) {
              const isFirstQuestionItem =
                parentNode[0].children[0] === currentNode;
              if (
                isFirstQuestionItem &&
                Editor.isStart(
                  editor,
                  editor.selection.anchor,
                  _currentNodePath
                )
              ) {
                event.preventDefault();
              }
            }
          }
        }

        // if (
        //   event.key === "_" &&
        //   event.shiftKey &&
        //   !event.ctrlKey &&
        //   !event.altKey
        // ) {
        //   const { selection } = editor;
        //   if (selection && Range.isCollapsed(selection)) {
        //     const [startTextNode, startPath] = Editor.node(
        //       editor,
        //       selection.anchor.path
        //     );

        //     if (startTextNode.text) {
        //       const textBeforeCaret = startTextNode.text.slice(
        //         0,
        //         selection.anchor.offset
        //       );
        //       const underscoreMatches = textBeforeCaret.match(/_{2,}$/);

        //       if (underscoreMatches) {
        //         event.preventDefault();

        //         const numberOfUnderscores = underscoreMatches[0].length;
        //         const textBeforeUnderscores = startTextNode.text.slice(
        //           0,
        //           selection.anchor.offset - numberOfUnderscores
        //         );
        //         const textAfterCaret = startTextNode.text.slice(
        //           selection.anchor.offset
        //         );

        //         const newChildren = [
        //           { text: textBeforeUnderscores },
        //           { text: " ", blank: true },
        //           { text: " " },
        //           { text: textAfterCaret },
        //         ];

        //         const parentNodePath = startPath.slice(0, -1);
        //         const [parentNode, _] = Editor.node(editor, parentNodePath);

        //         const newNode = {
        //           ...parentNode,
        //           children: parentNode.children
        //             .slice(0, startPath[startPath.length - 1])
        //             .concat(newChildren)
        //             .concat(
        //               parentNode.children.slice(
        //                 startPath[startPath.length - 1] + 1
        //               )
        //             ),
        //         };

        //         const textNodePoint = {
        //           path: startPath
        //             .slice(0, -1)
        //             .concat(startPath[startPath.length - 1] + 1),
        //           offset: 0,
        //         };

        //         Editor.withoutNormalizing(editor, () => {
        //           Transforms.removeNodes(editor, { at: parentNodePath });
        //           Transforms.insertNodes(editor, newNode, { at: parentNodePath });
        //         });

        //         Transforms.select(editor, textNodePoint);
        //       }
        //     }
        //   }
        // }

        if (event.ctrlKey || event.metaKey) {
          switch (event.key) {
            case "z": {
              event.preventDefault();
              if (event.shiftKey) {
                // Redo
                editor.redo();
              } else {
                // Undo
                editor.undo();
              }
              break;
            }
            case "y": {
              if (!event.shiftKey) {
                event.preventDefault();
                // Redo
                editor.redo();
              }
              break;
            }
            default:
              break;
          }
        }
      },
      [editor]
    );

    const handleEditLatex = (
      value: string,
      altText: string,
      path: Path,
      type
    ) => {
      const latex = value;
      const equationNode = {
        type,
        latex,
        altText,
        children: [{ text: "" }],
      };

      console.log(altText);

      Transforms.setNodes(editor, equationNode, { at: path });
      console.log(path);
      const currentElement = document.querySelector(
        `[data-path="${JSON.stringify(path)}"]`
      );
      console.log(currentElement);
    };

    const [getCurrentLatex, setCurrentLatex] = useState("");
    const [equationHeight, setEquationHeight] = useState<number | null>(null);

    const openEditBlockPopup = (
      _element: HTMLElement,
      event: React.MouseEvent,
      path: Path,
      type
    ) => {
      event.stopPropagation();
      const targetRect = _element.getBoundingClientRect();

      console.log(targetRect.left);
      const currentPathString = JSON.stringify(path);
      setActivePath(currentPathString);
      const spaceBelowTarget = window.innerHeight - targetRect.top;
      const [currentNode] = Editor.node(editor, path) as any;

      console.log(currentNode.latex);
      // setCurrentLatex(currentNode.latex);
      console.log(currentNode.id);

      console.log("open path", path);
      // setSelectedElementID();
      ReactEditor.blur(editor);
      setShowEditBlockPopup({
        open: true,
        element: type,
        path: JSON.stringify(path),
        latex: currentNode.latex,
      });
      // let topOffset;
      // let showDropdownAbove = false;
      // console.log(spaceBelowTarget);
      // const dropdownHeight = 280;
      // if (spaceBelowTarget < dropdownHeight) {
      //   topOffset = -(dropdownHeight - targetRect.height) + 10;
      //   showDropdownAbove = true;
      // }
      // setSearchBarPosition(spaceBelowTarget < dropdownHeight);

      // const equationHeight = _element.offsetHeight;
      // setDropdownEditBlockTop(
      //   showDropdownAbove ? targetRect.top + topOffset : targetRect.bottom - 5
      // );
      // setDropdownEditBlockLeft(targetRect.left);
    };

    const toggleRef = useRef<HTMLButtonElement>(null);
    const toggleEditBlockRef = useRef<HTMLElement>(null);

    const [addButtonHoveredId, setAddButtonHoveredId] = useState(null);

    const handleAddMCQBlock = useCallback((path: Path) => {
      setSearchMinidropdownText("");
      addMCQBlock(editor, path);
    }, []);

    const handleAddEditableEquationBlock = useCallback(
      (latex: string, path: Path) => {
        const { newPath, id } = addEditableEquationBlock(latex, editor, path);

        setShowEditBlockPopup({
          open: true,
          element: "equation",
          path: JSON.stringify(newPath),
          latex: "",
        });
        setActivePath(JSON.stringify(newPath));

        // const { id } = insertedEquationNode[0] as CustomElement;
        // console.log(id);
        // setSelectedElementID(id);

        setCurrentLatex("");
      },
      []
    );

    useLayoutEffect(() => {
      if (showEditBlockPopup.open && showEditBlockPopup.path) {
        const currentElement = document.querySelector(
          `[data-path="${showEditBlockPopup.path}"]`
        );
        console.log(currentElement);
        if (currentElement) {
          const targetRect = currentElement.getBoundingClientRect();
          const spaceBelowTarget = window.innerHeight - targetRect.top;

          let topOffset;
          let showDropdownAbove = false;
          console.log(spaceBelowTarget);
          let dropdownHeight = 200;
          //   showEditBlockPopup.element === "equation" ? 280 : 360;

          if (showEditBlockPopup.element === "inline-equation") {
            dropdownHeight = 200;
          }

          if (showEditBlockPopup.element === "equation") {
            dropdownHeight = 255;
          }

          if (
            showEditBlockPopup.element === "image" ||
            showEditBlockPopup.element === "datavis"
          ) {
            dropdownHeight = 380;
          }

          if (showEditBlockPopup.element === "embed") {
            dropdownHeight = 230;
          }
          if (spaceBelowTarget < dropdownHeight) {
            topOffset = -(dropdownHeight - targetRect.height) + 30;
            showDropdownAbove = true;
          }
          setSearchBarPosition(spaceBelowTarget < dropdownHeight);
          ReactEditor.blur(editor);
          setLastActiveSelection(null);
          setDropdownEditBlockTop(
            showDropdownAbove
              ? targetRect.top + topOffset
              : targetRect.bottom - 15
          );
          let targetCenter = targetRect.left + targetRect.width / 2;

          // Adjust for the popup width (which is 350px)
          let popupLeft = targetCenter - 350 / 2;

          const [currentNode] = Editor.node(
            editor,
            JSON.parse(showEditBlockPopup.path)
          ) as any;

          if (currentNode.type === "image") {
            popupLeft = targetCenter - 500 / 2;
          }

          if (currentNode.type === "datavis") {
            popupLeft = targetCenter - 480 / 2;
          }

          setDropdownEditBlockLeft(popupLeft);

          console.log(targetRect.left);
        }
      }
    }, [showEditBlockPopup, selectedElementID]);

    const MemoizedElementSelector = React.memo(ElementSelector);

    const elementRefs = new WeakMap();

    const renderElement = useCallback(
      (
        props: JSX.IntrinsicAttributes & {
          attributes: any;
          children: any;
          element: any;
          renderElement: any;
        }
      ) => {
        const { attributes, children, element } = props;

        const elementPath = ReactEditor.findPath(editor, element);
        const isRoot = elementPath.length === 1;

        if (!elementPath) return;

        const [parentElement, parentPath] = Editor.parent(editor, elementPath);
        const isInsideColumnCell =
          SlateElement.isElement(parentElement) &&
          (parentElement.type === "column-cell" ||
            parentElement.type === "tts");

        const addButton =
          (isRoot &&
            element.type !== "column" &&
            element.type !== "tts" &&
            element.type !== "title") ||
          isInsideColumnCell ? (
            <div className="z-1000" contentEditable={false}>
              <button
                className="addButton flex h-[24px] w-[24px] items-center justify-center rounded-md ease-in-out hover:bg-gray-300 dark:hover:bg-accent"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openMiniDropdown(ReactEditor.findPath(editor, element));
                  ReactEditor.blur(editor);
                }}
                ref={toggleRef}
              >
                <Plus
                  className="stroke-muted-foreground dark:stroke-muted-foreground"
                  width={20}
                />
              </button>
            </div>
          ) : null;
        if (!elementRefs.has(element)) {
          elementRefs.set(element, React.createRef());
        }
        const optionMenuRef = elementRefs.get(element);

        const optionMenu =
          isRoot ||
          (SlateElement.isElement(parentElement) &&
            parentElement.type === "tts") ? (
            <div className="flex w-[30px] ">
              <div className="absolute   right-[10px] top-0  items-center">
                <OptionMenu element={element} ref={optionMenuRef} />
              </div>
            </div>
          ) : null;

        const shouldWrapWithSortableElement =
          (isRoot &&
            element.type !== "column" &&
            element.type !== "title" &&
            element.type !== "tts") ||
          isInsideColumnCell;

        const content = shouldWrapWithSortableElement ? (
          <SortableElement
            {...props}
            addButton={addButton}
            optionMenu={optionMenu}
            renderElement={(props: any) => (
              <MemoizedElementSelector {...props} />
            )}
          />
        ) : (
          <MemoizedElementSelector {...props} />
        );

        return <>{content}</>;
      },
      []
    );

    // const [insertDirection, setInsertDirection] = useState(null);

    const [isDragging, setIsDragging] = useState(false);
    const [savedSelection, setSavedSelection] = useState(null);
    const textEditorRef = useRef<HTMLDivElement>(null);

    const handleDragEnd = useCallback(
      function (event: { active: any; over: any }) {
        const { active, over } = event;

        if (!active || !over) {
          console.log("Active or over are not defined");
          return;
        }

        if (active.id === over.id) {
          console.log("canceled");

          setIsDragging(false);
          console.log(event);
          const activeElementPath = findPathById(editor, active.id);
          console.log(activeElementPath);
          if (activeElementPath) {
            const endOfActiveElement = Editor.end(editor, activeElementPath);
            ReactEditor.focus(editor);
            Transforms.select(editor, endOfActiveElement);
          }
          setActiveId(null);
          return;
        }

        // Find the nodes using the ir IDs
        // setSelectedElementID(active.id);

        console.log("active", active.id, "over", over.id);
        const fromPath: any = findPathById(editor, active.id);
        const toPath: any = findPathById(editor, over.id);

        console.log("toPath", toPath);

        const [fromParentElement, fromParentPath]: any = Editor.parent(
          editor,
          fromPath
        );

        console.log(fromParentPath);
        const [toParentElement, toParentPath]: any = Editor.parent(
          editor,
          toPath
        );

        // Check if the dragged element should be inserted before or after the target element
        const toIndexOffset =
          fromParentPath.join() === toParentPath.join() &&
          fromParentPath[fromParentPath.length - 1] <
            toParentPath[toParentPath.length - 1]
            ? 1
            : 0;

        const isRootLevel = fromPath.length === 1 && toPath.length === 1;

        console.log("fromPath", fromPath[0], toPath[0]);
        // console.log(isRootLevel, creatingNewColumn);
        if (isRootLevel && creatingNewColumn) {
          // Adjust the over object according to the insertDirection

          console.log(
            toPath
              .slice(0, -1)
              .concat(toPath[toPath.length - 1] + toIndexOffset)
          );
          const targetPath = toPath
            .slice(0, -1)
            .concat(toPath[toPath.length - 1] + toIndexOffset);

          createColumns(
            fromPath,
            { id: over.id, path: targetPath },
            editor,
            insertDirection
          );
        } else if (
          SlateElement.isElement(fromParentElement) &&
          SlateElement.isElement(toParentElement) &&
          fromParentElement.type === "column-cell" &&
          toParentElement.type === "column-cell"
        ) {
          Transforms.moveNodes(editor, {
            at: fromPath,
            to: toPath
              .slice(0, -1)
              .concat(toPath[toPath.length - 1] + toIndexOffset),
          });
        } else {
          Transforms.moveNodes(editor, {
            at: fromPath,
            to: toParentPath.concat(toPath[toPath.length - 1] + toIndexOffset),
          });
        }

        const ifParentPathIsGreater = fromPath[0] > toPath[0];

        const newParentPath = ifParentPathIsGreater
          ? [fromParentPath[0] + 1, ...fromParentPath.slice(1)]
          : fromParentPath;
        if (
          SlateElement.isElement(fromParentElement) &&
          fromParentElement.type === "column-cell" &&
          fromParentElement.children.length === 1
        ) {
          Transforms.removeNodes(editor, { at: newParentPath });

          const [columnElement, columnPath] = Editor.parent(
            editor,
            newParentPath
          );

          console.log(columnPath);

          console.log(columnElement.children);
          if (
            SlateElement.isElement(columnElement) &&
            columnElement.type === "column" &&
            columnElement.children.length === 1 &&
            columnElement.children[0]?.text === ""
          ) {
            Transforms.removeNodes(editor, { at: columnPath });
          }
        }

        // setCheckEmptyColumnCells((prevCheck) => !prevCheck);
        setActiveId(null);
      },
      [editor, creatingNewColumn, activeId]
    );

    function Droppable({ children }) {
      const droppable = useDroppable({
        id: "droppable-area",
      });

      useDndMonitor({
        onDragOver(event) {
          const { active, over } = event;
          const cursorY = event.delta.y;

          console.log("drag", cursorY);
          if (cursorY > 0) {
            // If dragging downwards
            setCreatingNewColumn(false);
            setInsertDirection("down");
          } else if (cursorY < 0) {
            // If dragging downwards
            setCreatingNewColumn(false);
            setInsertDirection("up");
          }

          if (!over) {
            setCreatingNewColumn(false);
            setInsertDirection(null);
            return;
          }

          const activePath = findPathById(editor, active.id);
          const overPath = findPathById(editor, over.id);

          if (activePath && overPath) {
            const isNearRoot = activePath.length === 1 && overPath.length === 1;

            const activeNode = Node.get(editor, activePath);

            if (
              SlateElement.isElement(activeNode) &&
              activeNode.type === "slide"
            ) {
              setCreatingNewColumn(false);
              setInsertDirection(null);
              return;
            }

            if (isNearRoot) {
              const overElement = document.querySelector(
                `[data-id="${over.id}"]`
              );

              if (!overElement) return;
              const overRect = overElement.getBoundingClientRect();

              const cursorX = event.delta.x;

              const isCloseToLeft = cursorX < overRect.width * -0.05;
              const isCloseToRight = cursorX > overRect.width * 0.8;

              console.log(cursorX, overRect.left, overRect.width * 0.7);

              console.log("cursorX", cursorX);
              console.log("overRect left", overRect.left);

              console.log("overRect width", overRect.width * 0.7);

              if (isCloseToRight) {
                setCreatingNewColumn(true);
                setInsertDirection("right");
              } else if (isCloseToLeft) {
                setCreatingNewColumn(true);
                setInsertDirection("left");
              } else {
                setCreatingNewColumn(false);
                setInsertDirection(null);
              }
            }
          } else {
            setCreatingNewColumn(false);
            setInsertDirection(null);
          }
        },
      });

      return <div ref={droppable.setNodeRef}>{children}</div>;
    }

    const handleDragStart = useCallback(function ({ active }) {
      console.log(active.id);
      setActiveId(active.id);
      setIsDragging(true);
      setSavedSelection(editor.selection);
    }, []);

    useClickOutside(
      addSomethingDropdownRef,
      () => {
        if (showDropdown) {
          setShowDropdown(false);
        }
      },
      toggleRef
    );

    useClickOutside(
      editBlockDropdownRef,
      () => {
        if (showEditBlockPopup) {
          setShowEditBlockPopup({
            open: false,
            element: null,
            path: "",
            latex: "",
          });
        }
      },
      toggleEditBlockRef
    );

    const closeEditableDropdown = () => {
      if (showEditBlockPopup) {
        setShowEditBlockPopup({
          open: false,
          element: null,
          path: "",
          latex: "",
        });
        setactiveEditEquationPath(null);
      }
    };

    function handleEditorMouseUp(
      event: React.MouseEvent<globalThis.Element, MouseEvent>,
      editor: any
    ) {
      setShowMiniToolbar(false);

      const equationElement = findAncestorWithClass(
        event.target,
        "equation-element"
      );

      const inlineEquationElement = findAncestorWithClass(
        event.target,
        "inline-equation-element"
      );

      console.log(equationElement);
      if (equationElement) {
        const pathString = equationElement.getAttribute("data-path");
        if (pathString) {
          const path = JSON.parse(pathString);
          // setActivePath(pathString);
          openEditBlockPopup(equationElement, event, path, "equation");
          return;
        }
      }

      if (inlineEquationElement) {
        const pathString = inlineEquationElement.getAttribute("data-path");
        if (pathString) {
          const path = JSON.parse(pathString);
          // setActivePath(pathString);
          openEditBlockPopup(
            inlineEquationElement,
            event,
            path,
            "inline-equation"
          );
          return;
        }
      }

      const selection = document.getSelection();
      if (
        !selection ||
        !selection.anchorNode ||
        !ReactEditor.hasDOMNode(editor, selection.anchorNode)
      ) {
        return;
      }

      const lastNode: any = editor.children[editor.children.length - 1];
      const lastNodePath = ReactEditor.findPath(editor, lastNode);

      // if (
      //   lastNode.type === "equation" ||
      //   lastNode.type === "audio" ||
      //   lastNode.type === "slide"
      // ) {
      //   insertNewParagraphBelowLastNode(lastNodePath);
      //   event.stopPropagation();
      //   return;
      // }

      const lastNodeDOM = document.querySelector(
        `[data-path="${JSON.stringify(lastNodePath)}"]`
      );
      const lastNodeRect = lastNodeDOM && lastNodeDOM.getBoundingClientRect();
      const clickedY = event.clientY;
      const isLastNodeEmpty =
        SlateElement.isElement(lastNode) &&
        lastNode.children.length === 1 &&
        lastNode.children[0].text === "";
      if (lastNodeRect && clickedY > lastNodeRect.bottom && !isLastNodeEmpty) {
        insertNewParagraphBelowLastNode(lastNodePath);
        event.stopPropagation();
      }
    }

    function insertNewParagraphBelowLastNode(lastNodePath: string | any[]) {
      const newParagraph = {
        id: genNodeId(),
        type: "paragraph",
        align: "start",
        children: [{ text: "" }],
      };
      const newPath = lastNodePath
        .slice(0, -1)
        .concat(lastNodePath[lastNodePath.length - 1] + 1) as any[];
      Transforms.insertNodes(editor, newParagraph, { at: newPath });
      const leafNodePath = newPath.concat(0);
      Transforms.select(editor, Editor.start(editor, newPath));
    }

    const renderSubjectComponent = () => {
      switch (showFloatingModal.subject) {
        case "math":
          return <MathQuestionGenerator />;
        case "english":
          return <EnglishQuestionGenerator />;
        // Add more cases for other subjects here
        default:
          return null;
      }
    };

    const getModalTitle = () => {
      switch (showFloatingModal.subject) {
        case "math":
          return "Math Questions";
        case "english":
          return "English Questions";
        // Add more cases for other subjects here
        default:
          return "Homework Creator";
      }
    };

    const toolbarRef = useRef(null);
    useClickOutside(
      toolbarRef,
      () => {
        if (showMiniToolbar) {
          setShowMiniToolbar(false);
          setToolbarWidth(200);
          setOpenLink(false);
        }
      },
      textEditorRef
    );
    const [dynamicToolbarWidth, setToolbarWidth] = useState(200);
    const [openLink, setOpenLink] = useState(false);

    useEffect(() => {
      if (editor.selection) setLastActiveSelection(editor.selection);
    }, [editor.selection]);

    const decorate = ([node, path]) => {
      if (node.type === "title") return [];
      if (lastActiveSelection != null) {
        const intersection = Range.intersection(
          lastActiveSelection,
          Editor.range(editor, path)
        );

        if (intersection == null) {
          return [];
        }

        const range = {
          highlighted: true,
          ...intersection,
        };

        return [range];
      }
      return [];
    };

    const handleSelectedText = debounce(
      useCallback(
        (
          event:
            | React.KeyboardEvent<HTMLDivElement>
            | React.MouseEvent<HTMLDivElement, MouseEvent>,
          editor: any
        ) => {
          event.stopPropagation();

          const { selection } = editor;
          if (selection) {
            const _currentNodePath = selection.anchor.path.slice(0, -1);
            // console.log(_currentNodePath);
            setActivePath(JSON.stringify(_currentNodePath));
          }
          if (selection && !Range.isCollapsed(selection)) {
            const domSelection = window.getSelection();
            if (domSelection && domSelection.rangeCount > 0) {
              const range = domSelection.getRangeAt(0);
              const startContainer = range.startContainer;
              const endContainer = range.endContainer;
              const endOffset = range.endOffset;

              if (
                startContainer.nodeType === startContainer.TEXT_NODE &&
                endContainer.nodeType === endContainer.TEXT_NODE
              ) {
                const startPath = Editor.path(editor, selection, {
                  edge: "start",
                });
                const [startNode] = Editor.parent(editor, startPath);

                if (
                  SlateElement.isElement(startNode) &&
                  (startNode.type === "paragraph" ||
                    startNode.type === "link" ||
                    startNode.type === "block-quote" ||
                    startNode.type === "option-list-item" ||
                    startNode.type === "bulleted-list" ||
                    startNode.type === "numbered-list" ||
                    startNode.type === "checked-list" ||
                    startNode.type === "heading-one" ||
                    startNode.type === "heading-two" ||
                    startNode.type === "heading-three")
                ) {
                  const startRange = document.createRange();
                  startRange.setStart(startContainer, range.startOffset);
                  startRange.setEnd(startContainer, range.startOffset);
                  const startRect = startRange.getBoundingClientRect();

                  const endRange = document.createRange();
                  endRange.setStart(endContainer, endOffset);
                  endRange.setEnd(endContainer, endOffset);
                  const endRect = endRange.getBoundingClientRect();

                  const selectionRect = range.getBoundingClientRect();

                  // Get the text editor's dimensions
                  const textEditorRect =
                    textEditorRef.current?.getBoundingClientRect() || {
                      top: 0,
                      width: 100,
                      left: 0,
                    };

                  const textEditorWidth = textEditorRect?.width;
                  const textEditorLeft = textEditorRect?.left;

                  // Get all rectangles that make up the selection
                  const rects = range.getClientRects();
                  const firstRect = rects[0] || { left: 0, top: 0 };

                  // Calculate mini toolbar position
                  let initialX = firstRect.left - textEditorLeft;
                  const toolbarWidth = 490; // Your toolbar width
                  // Access the alignment of the current element and adjust initialX based on the alignment
                  if (startNode.align) {
                    switch (startNode.align) {
                      case "center":
                        initialX -= toolbarWidth / 2;
                        break;
                      case "end":
                        initialX -= toolbarWidth;
                        break;
                      default:
                        // do nothing for 'start' as it's already handled by your initial calculation
                        break;
                    }
                  }

                  const x = Math.max(
                    Math.min(initialX, textEditorWidth - toolbarWidth - 20),
                    0
                  );

                  const scrollTop = (textEditorRef.current as HTMLElement)
                    .scrollTop;

                  setMiniToolbarPosition({
                    x: x,
                    y:
                      firstRect.top -
                      window.scrollY -
                      textEditorRect.top -
                      60 +
                      scrollTop,
                  });

                  // const isActiveLink = getActiveLinkUrl(editor);

                  // if (isActiveLink) {
                  //   setOpenLink(true);
                  // } else {
                  //   setOpenLink(false);
                  // }

                  setShowMiniToolbar(true);

                  const selectedText = Editor.string(editor, selection);
                  const extractedText = textRegex(selectedText);
                }
              }
            }
          } else {
            setShowMiniToolbar(false);
            setOpenLink(false);
          }
        },
        [dynamicToolbarWidth]
      ),
      300
    );

    const [windowSize, setWindowSize] = useState({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    useEffect(() => {
      const handleResize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      };

      window.addEventListener("resize", handleResize);

      // Clean up the event listener on component unmount
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }, []);

    const { showRightSidebar, setShowRightSidebar, scrolltoSlide, tab } =
      useTextSpeech();

    const rightSideBarWidth = 300;

    const minSidebarWidth = 390;
    const maxSidebarWidth = 570;
    const { elementWidth, handleDrag, isDraggingRightSideBar, handleDragStop } =
      useResizeSidebar(rightSideBarWidth, minSidebarWidth, maxSidebarWidth);

    useEffect(() => {
      localStorage.setItem(
        "showRightSidebar",
        JSON.stringify(showRightSidebar)
      );
    }, [showRightSidebar]);

    const slides = splitIntoSlides(slatevalue);
    useLayoutEffect(() => {
      if (slides.length === 0) return;

      const editorDiv = textEditorRef.current;
      if (!editorDiv) return;

      let targetElement;

      if (scrolltoSlide === 1) {
        // targetElement = editorDiv.querySelector(`[data-element="title"]`);
        const startPosition = editorDiv.scrollTop;
        const totalFrames = 30; // You can adjust this for a faster or slower scroll
        let currentFrame = 0;

        const scrollToTop = () => {
          editorDiv.scrollTop =
            startPosition * (1 - currentFrame / totalFrames);
          currentFrame += 1;

          if (currentFrame <= totalFrames) {
            requestAnimationFrame(scrollToTop);
          }
        };

        requestAnimationFrame(scrollToTop);
        return;
      } else {
        targetElement = editorDiv.querySelector(
          `[data-slide="${scrolltoSlide}"]`
        );
      }

      if (tab === "bookView") {
        targetElement?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, [scrolltoSlide]);

    const [lastChild, setLastChild] = useState<Node | null>(null);

    useEffect(() => {
      const currentLastChild = editor.children[editor.children.length - 1];

      // Compare current last child with stored last child
      if (!isEqual(currentLastChild, lastChild)) {
        if (textEditorRef.current) {
          const container = textEditorRef.current;
          container.scrollTop = container.scrollHeight;
        }
        // Update stored last child
        setLastChild(currentLastChild);
      }
    }, [editor.children]);

    const [selectionRect, setSelectionRect] = useState(null);
    const [mouseDown, setMouseDown] = useState(false);

    const onMouseDown = (e) => {
      setMouseDown(true);
      setSelectionRect({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
    };

    const onMouseMove = (e) => {
      if (!mouseDown) return;
      setSelectionRect((rect) => ({
        ...rect,
        width: e.clientX - rect.x,
        height: e.clientY - rect.y,
      }));
    };

    const onMouseUp = () => {
      setMouseDown(false);
    };

    return (
      <div
        className="relative mx-auto mt-[50px] flex justify-center lg:max-w-[1000px]  xl:max-w-[1400px]"
        style={{
          width:
            windowSize.width > breakpoints.xl
              ? `${rightSideBarWidth + 790}px`
              : "95vw",
        }}
      >
        <Portal>
          <button
            className="group fixed right-[30px] top-[25px] z-0 hidden rounded  border-gray-300 p-1 transition duration-300 hover:border-brand dark:border-accent dark:hover:border-foreground dark:hover:bg-muted lg:block"
            onClick={() => {
              setShowRightSidebar(!showRightSidebar);
            }}
          >
            {!showRightSidebar ? (
              <VscLayoutSidebarRightOff className="  h-[20px] w-[20px] text-darkergray transition duration-300 group-hover:text-brand dark:text-muted-foreground dark:group-hover:text-foreground" />
            ) : (
              <VscLayoutSidebarRight className="  h-[20px] w-[20px] text-darkergray transition duration-300 group-hover:text-brand dark:text-muted-foreground dark:group-hover:text-foreground" />
            )}
          </button>
        </Portal>
        <div className="flex  gap-4 lg:justify-center xl:px-4">
          <div className="mx-auto block">
            <div
              className="relative  z-0   min-w-[90vw]  rounded-md border  border-gray-300 bg-white px-2 dark:border-accent dark:bg-muted dark:text-foreground lg:min-w-[500px]  lg:px-0 xl:min-w-[740px]"
              style={{
                right:
                  windowSize.width > breakpoints.lg
                    ? !showRightSidebar
                      ? -(rightSideBarWidth / 2)
                      : 0
                    : 0,
                maxWidth: "740px",
                width:
                  windowSize.width > breakpoints.lg
                    ? showRightSidebar
                      ? "50vw"
                      : "100vw"
                    : "95vw",
                height: "calc(100svh - 100px)",
                transition: "right 0.3s ease-in-out, width 0.3s ease-in-out",
              }}
              // onMouseDown={onMouseDown}
              // onMouseMove={onMouseMove}
              // onMouseUp={onMouseUp}
            >
              {/* <div
                style={{
                  position: "absolute",
                  left: `${selectionRect?.x}px`,
                  top: `${selectionRect?.y}px`,
                  width: `${selectionRect?.width}px`,
                  height: `${selectionRect?.height}px`,
                  backgroundColor: "rgba(0, 0, 255, 0.5)",
                }}
              /> */}
              <div className="absolute -top-[40px] left-0 flex w-full items-center justify-between ">
                <div className="flex items-center">
                  {/* <span className="rounded-md  px-2 py-1 text-sm dark:border-white">
                    Credits:
                  </span>
                  <span className="text-sm font-bold">
                    {" "}
                    {credits && String(credits)}
                  </span> */}
                </div>
              </div>

              <div className="block  lg:w-full">
                <DndContext
                  onDragEnd={handleDragEnd}
                  onDragStart={handleDragStart}
                  sensors={sensors}
                >
                  <SortableContext
                    items={slatevalue}
                    strategy={verticalListSortingStrategy}
                  >
                    <ActiveElementProvider activeIndex={activeIndex}>
                      <div
                        ref={textEditorRef}
                        tabIndex={0}
                        className="scrollbar relative z-0 flex overflow-y-auto overflow-x-hidden  pb-4 pt-2 focus:outline-none focus-visible:border-gray-300  lg:justify-center"
                      >
                        <Slate
                          key={currentSlateKey}
                          editor={editor}
                          value={slatevalue}
                          onChange={(newValue) => {
                            if (!isEqual(slatevalue, newValue)) {
                              setValue(newValue);
                              debouncedSetSlateValue(newValue);
                            }
                          }}
                        >
                          <Droppable>
                            <Editable
                              className="relative w-full lg:w-[500px] xl:w-[740px]"
                              style={{
                                height: "calc(100svh - 140px)",
                              }}
                              decorate={decorate}
                              renderElement={renderElement as any}
                              renderLeaf={Leaf as any}
                              onMouseUp={(event) => {
                                handleEditorMouseUp(event, editor);
                                handleSelectedText(event, editor);
                              }}
                              scrollSelectionIntoView={() => {}}
                              spellCheck={false}
                              onKeyDown={handleKeyDown}
                              onKeyUp={(event) => {
                                handleSelectedText(event, editor);

                                const { selection } = editor;
                                if (!selection) return;
                                const _currentNodePath =
                                  selection.anchor.path.slice(0, -1);
                                setusingCommandLine(false);
                                const currentNode = Node.get(
                                  editor,
                                  _currentNodePath
                                );

                                if (event.key === "Backspace") {
                                  const { selection } = editor;

                                  if (
                                    selection &&
                                    Range.isCollapsed(selection)
                                  ) {
                                    const _currentNodePath =
                                      selection.anchor.path.slice(0, -1);
                                    const _stringcurrentNode = Editor.node(
                                      editor,
                                      _currentNodePath
                                    );
                                    const currentText = Node.string(
                                      _stringcurrentNode[0]
                                    );
                                    // Check if currentNode is an equation

                                    if (currentText.endsWith("/")) {
                                      // setShowDropdown(false);
                                      setSearchMinidropdownText("");
                                    } else {
                                      const slashIndex =
                                        currentText.lastIndexOf("/");
                                      if (slashIndex !== -1) {
                                        // Extract the text after the last "/" in the currentText
                                        const searchText = currentText.slice(
                                          slashIndex + 1
                                        );
                                        setSearchMinidropdownText(searchText);
                                      } else {
                                        setSearchMinidropdownText("");
                                        setusingCommandLine(false);
                                        setShowDropdown(false); // Close the mini-dropdown if there's no "/"
                                      }
                                    }
                                  }
                                }
                              }}
                            />
                          </Droppable>
                        </Slate>

                        {showMiniToolbar && (
                          <AnimatePresence>
                            <StyledMiniToolbar
                              className=" rounded-lg border bg-white shadow-md shadow-gray-500 dark:border-accent dark:bg-secondary dark:shadow-background"
                              ref={toolbarRef}
                              {...up_animation_props}
                              exit={{ opacity: 0 }}
                              style={{
                                top: miniToolbarPosition.y,
                                left: miniToolbarPosition.x,
                              }}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                            >
                              <Toolbar
                                showMiniToolbar={showMiniToolbar}
                                openLink={openLink}
                                setOpenLink={setOpenLink}
                                setShowMiniToolbar={setShowMiniToolbar}
                              />
                              {/* <TextSpeech key="selectedText" isSelected={true} /> */}
                            </StyledMiniToolbar>
                          </AnimatePresence>
                        )}
                      </div>
                    </ActiveElementProvider>
                  </SortableContext>
                  {isDragging && (
                    <DragOverlay>
                      {activeId ? (
                        <DragOverlayContent
                          element={findElementInSlateValue(
                            slatevalue,
                            activeId
                          )}
                        />
                      ) : null}
                    </DragOverlay>
                  )}
                </DndContext>
                <AnimatePresence>
                  {showDropdown && activePath && (
                    <motion.div
                      // {...y_animation_props}
                      {...slightbouncey}
                      className="fixed left-[120px] z-10 mx-auto mt-2 block w-[320px]"
                      style={{
                        transformOrigin: "top left",
                        top: `${dropdownTop}px`,
                        left: `${dropdownLeft}px`,
                      }}
                      ref={addSomethingDropdownRef}
                    >
                      <MiniDropdown
                        isOpen={showDropdown}
                        addMCQBlock={() => {
                          handleAddMCQBlock(JSON.parse(activePath));
                          setShowDropdown(false);
                        }}
                        addEquationBlock={() => {
                          handleAddEditableEquationBlock(
                            "",
                            JSON.parse(activePath)
                          );
                          setShowDropdown(false);
                        }}
                        genBlock={(_subject) => {
                          console.log("add block");
                          setShowFloatingModal({
                            open: true,
                            subject: _subject,
                          });
                          setShowDropdown(false);
                        }}
                        setShowDropdown={setShowDropdown}
                        activePath={activePath}
                        searchBarPosition={searchBarPosition}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {showEditBlockPopup.open && (
                    <>
                      <div className="closeOutside z-1  fixed left-0 top-0 h-full w-screen  opacity-50"></div>
                      <motion.div
                        {...y_animation_props}
                        className={cn(
                          `fixed  z-10 z-10 mx-auto mt-2 mt-2 w-[380px]`,
                          showEditBlockPopup.element === "datavis" &&
                            "w-[450px]"
                        )}
                        style={{
                          top: `${dropdownEditBlockTop}px`,
                          left: `${dropdownEditBlockLeft}px`,
                        }}
                      >
                        {showEditBlockPopup.element === "equation" && (
                          <EditBlockPopup
                            ref={editBlockDropdownRef}
                            onChange={(latex, altText) =>
                              handleEditLatex(
                                latex,
                                altText,
                                JSON.parse(activePath),
                                "equation"
                              )
                            }
                            latexValue={showEditBlockPopup.latex}
                            onClick={closeEditableDropdown}
                            insertText={(note) => {
                              Transforms.insertNodes(
                                editor,
                                {
                                  id: genNodeId(),
                                  type: "paragraph",
                                  align: "start",
                                  children: [{ text: note }],
                                },
                                {
                                  at: Path.next(JSON.parse(activePath)),
                                }
                              );
                            }}
                          />
                        )}

                        {showEditBlockPopup.element === "inline-equation" && (
                          <EditBlockPopup
                            ref={editBlockDropdownRef}
                            onChange={(latex, altText) =>
                              handleEditLatex(
                                latex,
                                altText,
                                JSON.parse(showEditBlockPopup.path),
                                "inline-equation"
                              )
                            }
                            latexValue={getCurrentLatex}
                            onClick={closeEditableDropdown}
                            insertText={(note) => {
                              Transforms.insertNodes(
                                editor,
                                {
                                  id: genNodeId(),
                                  type: "paragraph",
                                  align: "start",
                                  children: [{ text: note }],
                                },
                                {
                                  at: Path.next(JSON.parse(activePath)),
                                }
                              );
                            }}
                          />
                        )}
                        {showEditBlockPopup.element === "image" && (
                          <div
                            ref={editBlockDropdownRef}
                            className="z-100 h-[180px] rounded-lg border border-gray-400 bg-background p-2 shadow-md dark:border-accent  dark:border-accent dark:bg-muted dark:text-foreground lg:w-[400px]  lg:w-[500px]"
                          >
                            <ImageEmbedLink />
                          </div>
                        )}

                        {showEditBlockPopup.element === "embed" && (
                          <div
                            ref={editBlockDropdownRef}
                            className="z-100 h-[120px] rounded-lg border border-gray-400 bg-background p-2 shadow-md dark:border-accent  dark:border-accent dark:bg-muted dark:text-foreground "
                          >
                            {/* <div className=" block w-full">hello</div> */}
                            <EmbedLink />
                          </div>
                        )}

                        {showEditBlockPopup.element === "datavis" && (
                          <div
                            ref={editBlockDropdownRef}
                            className="z-100 h-[270px] rounded-lg border border-gray-400 bg-background p-2 shadow-md dark:border-accent  dark:border-accent dark:bg-muted dark:text-foreground "
                          >
                            <h3 className="mb-2 mt-2 pl-2 font-bold text-muted-foreground ">
                              Line, Bar, Pie Charts
                            </h3>
                            {/* <div className=" block w-full">hello</div> */}
                            <SelectDataVis />
                          </div>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
                {showFloatingModal.open && (
                  <FloatingModal
                    title={getModalTitle()}
                    initialX={dropdownLeft}
                    initialY={dropdownTop}
                    onClose={() =>
                      setShowFloatingModal({ open: false, subject: "" })
                    }
                  >
                    {renderSubjectComponent()}
                  </FloatingModal>
                )}
              </div>
            </div>
          </div>

          <RightSideBar
            showRightSidebar={showRightSidebar}
            rightSideBarWidth={rightSideBarWidth}
          />
        </div>
      </div>
    );
  }
);

export default DocumentEditor;
