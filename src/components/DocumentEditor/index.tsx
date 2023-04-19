import React, {
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
  useContext,
  createContext,
} from "react";
import {
  createEditor,
  Editor,
  Transforms,
  Path,
  BaseEditor,
  Range,
  Node,
  Element,
  Location,
} from "slate";

import { createPortal } from "react-dom";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { Plus, CornerDownLeft, MoreHorizontal } from "lucide-react";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import "katex/dist/contrib/mhchem.min.js";
import { AnimatePresence, motion } from "framer-motion";
import { nanoid } from "nanoid";

import Image from "next/image";

import styled, { useTheme } from "styled-components";
import useClickOutside from "@/hooks/useClickOutside";

import { LayoutContext } from "../Layouts/AccountLayout";
import { y_animation_props } from "../Dropdown";
import { findElementInSlateValue } from "./helpers/findElementInSlate";
import { MathQuestionGenerator } from "../QuestionGenerator/Math";
import dynamic from "next/dynamic";

import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDndMonitor,
} from "@dnd-kit/core";

import { genNodeId } from "@/hoc/withID";

import {
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { useEditor } from "@/hooks/useEditor";
import { ActiveElementProvider } from "@/contexts/ActiveElementContext";
import { SortableElement } from "./SortableElement";
import { ElementSelector } from "./EditorElements";
import { EditorProvider } from "@/contexts/EditorContext";
import { DragOverlayContent } from "./DragOverlayContent";

import { findAncestorWithClass } from "@/utils/findAncestors";

import { useNewColumn } from "@/contexts/NewColumnContext";
import { useSensor, useSensors, MouseSensor } from "@dnd-kit/core";
import { findPathById, createColumns } from "./helpers/createColumns";
import { FloatingModal } from "@/components/FloatingModal";
import { Blank } from "./LeafElements/Blank";
import { MiniDropdown } from "./MiniDropdown";
import { OptionMenu } from "./OptionMenu";
interface DocumentEditorProps {
  workspaceId: string;
  handleTextChange?: (value: any) => void;
  initialSlateValue?: any;
}

type CustomElement = {
  id: string;
  type: string;
  children: CustomText[];
  altText?: string;
  correctAnswer?: false;
  questionNumber?: number;
  latex?: string; // Add this line for the latex string
};

type CustomText = {
  text: string;
};

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

import { EditBlockPopup } from "../EditEquationBlock";
import { EnglishQuestionGenerator } from "../QuestionGenerator/English";

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  workspaceId,
  handleTextChange,
  initialSlateValue,
}) => {
  const theme = useTheme();
  const { isLocked } = useContext(LayoutContext);
  const editor = useEditor();
  const [slatevalue, setValue] = useState(initialSlateValue);

  useEffect(() => {
    setValue(initialSlateValue);
  }, [initialSlateValue]);

  const [activeId, setActiveId] = useState("");

  const activeIndex = activeId
    ? slatevalue.findIndex((el) => el.id === activeId)
    : -1;

  const [showDropdown, setShowDropdown] = useState(false);
  const [showEditBlockPopup, setShowEditBlockPopup] = useState(false);

  const sensors = useSensors(useSensor(MouseSensor));

  const [dropdownPositions, setDropdownPositions] = useState<
    Map<string, { top: number; left: number }>
  >(new Map());

  const [activePath, setActivePath] = useState<string>("");
  const [activeEditEquationPath, setactiveEditEquationPath] = useState<
    string | null
  >(null);

  const addSomethingDropdownRef = useRef<HTMLDivElement | null>(null);
  const editBlockDropdownRef = useRef<HTMLDivElement | null>(null);

  const [dropdownTop, setDropdownTop] = useState<number>(0);
  const [dropdownLeft, setDropdownLeft] = useState<number>(0);

  const [dropdownEditBlockTop, setDropdownEditBlockTop] = useState<
    number | null
  >(0);
  const [dropdownEditBlockLeft, setDropdownEditBlockLeft] = useState<
    number | null
  >(0);

  const { creatingNewColumn, setCreatingNewColumn } = useNewColumn();

  const slatePathToNumber = (path: number[]): number => {
    const pathStr = path.map((num) => num.toString()).join("");
    return parseInt(pathStr, 10);
  };

  const [checkEmptyColumnCells, setCheckEmptyColumnCells] = useState(false);

  const [showFloatingModal, setShowFloatingModal] = useState({
    open: false,
    subject: "",
  });

  const [selectedElementID, setSelectedElementID] = useState<string>("");

  const openMiniDropdown = useCallback(
    (event: React.MouseEvent, path: Path) => {
      const currentpathString = JSON.stringify(path);

      const sideBarOffset = isLocked ? -150 : 0;

      setActivePath(currentpathString);

      const target = event.currentTarget as HTMLDivElement;
      const targetRect = target.getBoundingClientRect();

      setDropdownTop(targetRect.bottom + 50);
      setDropdownLeft(targetRect.left + 60 + sideBarOffset);
      setShowDropdown((prevState) => !prevState);
    },
    [dropdownPositions, isLocked]
  );

  function insertNewParagraphEnter(newPath: Path) {
    const newNode = {
      id: genNodeId(),
      type: "paragraph",
      children: [{ text: "" }],
    };

    Transforms.insertNodes(editor, newNode, { at: newPath });
    Transforms.select(editor, Editor.start(editor, newPath));
  }

  function splitTitleNode(newPath: Path, _currentNodePath: any) {
    Transforms.splitNodes(editor);
    Transforms.setNodes(
      editor,
      { id: genNodeId(), type: "paragraph" },
      { at: newPath }
    );
  }

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const { selection } = editor;
      const _currentNodePath = selection.anchor.path.slice(0, -1);

      if (!selection || !ReactEditor.isFocused(editor)) {
        return;
      }

      const startPosition = selection.anchor;
      const [currentNode, currentNodePath] = Editor.parent(
        editor,
        startPosition.path
      );

      let updatedNode = null;

      if (event.key === "Enter") {
        event.preventDefault();

        if (selection) {
          const [parentNode, parentPath] = Editor.parent(
            editor,
            selection.anchor.path
          );

          if (parentNode.type === "paragraph") {
            const newPath = Path.next(parentPath);
            if (Editor.isEnd(editor, selection.anchor, _currentNodePath)) {
              insertNewParagraphEnter(newPath);
            } else {
              Transforms.splitNodes(editor);

              const newId = genNodeId();
              Transforms.setNodes(editor, { id: newId }, { at: newPath });
            }

            if (
              Editor.isStart(editor, editor.selection.anchor, _currentNodePath)
            ) {
              insertNewParagraphEnter(newPath);
            }
          }

          if (parentNode.type === "title") {
            const nextNode = Editor.next(editor, { at: parentPath });

            if (
              !nextNode ||
              (nextNode &&
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
                return;
              }
              if (Editor.isEnd(editor, selection.anchor, _currentNodePath)) {
                const newPath = Path.next(parentPath);
                Transforms.insertNodes(
                  editor,
                  {
                    type: "paragraph",
                    children: [{ text: "" }],
                  },
                  { at: newPath }
                );
                Transforms.select(editor, newPath);
              } else {
                const newPath = Path.next(parentPath);
                splitTitleNode(newPath, _currentNodePath);
              }
            } else {
              // Otherwise, split the nodes and create a new paragraph as before

              if (Editor.isEnd(editor, selection.anchor, _currentNodePath)) {
                const newPath = Path.next(parentPath);
                insertNewParagraphEnter(newPath);
              } else {
                splitTitleNode(parentPath, _currentNodePath);
              }
            }
          }

          if (parentNode.type === "option-list-item") {
            const newPath = Path.next(parentPath);
            const newNode = {
              id: genNodeId(),
              type: "option-list-item",
              children: [{ text: "" }],
              correctAnswer: false,
            };
            Transforms.insertNodes(editor, newNode, { at: newPath });
            Transforms.select(editor, Editor.start(editor, newPath));
            updatedNode = newNode;
          }
        }
      }

      if (event.key === "Backspace") {
        const { selection } = editor;

        if (selection && Range.isCollapsed(selection)) {
          const currentNode = Node.get(editor, currentNodePath);
          const currentParagraph = Editor.node(editor, currentNodePath);
          const parentNode = Editor.parent(editor, currentNodePath);
          // Check if currentNode is an equation

          if (currentNode.type === "equation") {
            event.preventDefault();
          } else {
            // Check if the previous node is an equation
            const prevNodeEntry = Editor.previous(editor, {
              at: currentNodePath,
            });

            if (prevNodeEntry) {
              const [_prevNode] = prevNodeEntry;

              if (
                _prevNode.type === "equation" &&
                Editor.isStart(editor, selection.anchor, _currentNodePath)
              ) {
                event.preventDefault();
                const nextParagraph = Editor.previous(editor, {
                  at: currentParagraph[1],
                  match: (n) => n.type === "paragraph",
                });
                if (nextParagraph) {
                  const [nextNode, nextPath] = nextParagraph;
                  const targetPosition = Editor.end(editor, nextPath);
                  Transforms.select(editor, targetPosition);
                }
              }
            }
          }

          if (currentNode.type === "list-item") {
            const parentNode = Editor.parent(editor, currentNodePath);
            if (parentNode[0].type === "mcq") {
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
            (currentNode.type === "option-list-item" || updatedNode) &&
            parentNode[0].type === "ol"
          ) {
            const mcqNode = Editor.parent(editor, parentNode[1]);
            if (mcqNode[0].type === "mcq") {
              const optionListItems = parentNode[0].children.filter(
                (child) => child.type === "option-list-item"
              );

              if (optionListItems.length <= 2) {
                const isEmpty =
                  (currentNode.children.length === 1 &&
                    currentNode.children[0].text === "") ||
                  (updatedNode && updatedNode.children[0].text === "");
                if (isEmpty) {
                  event.preventDefault();
                }
              }
            }
          }
        }
      }

      if (
        event.key === "_" &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const { selection } = editor;
        if (selection && Range.isCollapsed(selection)) {
          const [startTextNode, startPath] = Editor.node(
            editor,
            selection.anchor.path
          );

          if (startTextNode.text) {
            const textBeforeCaret = startTextNode.text.slice(
              0,
              selection.anchor.offset
            );
            const underscoreMatches = textBeforeCaret.match(/_{2,}$/);

            if (underscoreMatches) {
              event.preventDefault();

              const numberOfUnderscores = underscoreMatches[0].length;
              const textBeforeUnderscores = startTextNode.text.slice(
                0,
                selection.anchor.offset - numberOfUnderscores
              );
              const textAfterCaret = startTextNode.text.slice(
                selection.anchor.offset
              );

              const newChildren = [
                { text: textBeforeUnderscores },
                { text: " ", blank: true },
                { text: " " },
                { text: textAfterCaret },
              ];

              const parentNodePath = startPath.slice(0, -1);
              const [parentNode, _] = Editor.node(editor, parentNodePath);

              const newNode = {
                ...parentNode,
                children: parentNode.children
                  .slice(0, startPath[startPath.length - 1])
                  .concat(newChildren)
                  .concat(
                    parentNode.children.slice(
                      startPath[startPath.length - 1] + 1
                    )
                  ),
              };

              const textNodePoint = {
                path: startPath
                  .slice(0, -1)
                  .concat(startPath[startPath.length - 1] + 1),
                offset: 0,
              };

              Editor.withoutNormalizing(editor, () => {
                Transforms.removeNodes(editor, { at: parentNodePath });
                Transforms.insertNodes(editor, newNode, { at: parentNodePath });
              });

              Transforms.select(editor, textNodePoint);
            }
          }
        }
      }

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

  function handleCursorClick(event, editor) {
    event.preventDefault();
    event.stopPropagation();
    const { selection } = editor;

    if (selection) {
      const startPosition = selection.anchor;
      const [currentNode, currentNodePath] = Editor.parent(
        editor,
        startPosition.path
      );
    }
  }

  const handleEditLatex = (value: string, altText: string, path: Path) => {
    const latex = value;
    const equationNode = {
      type: "equation",
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
    path: Path
  ) => {
    event.stopPropagation();
    const targetRect = _element.getBoundingClientRect();

    const sideBarOffset = isLocked ? -150 : 0;
    console.log(targetRect.left);
    const currentPathString = JSON.stringify(path);
    setactiveEditEquationPath((prevPath) =>
      prevPath === currentPathString ? null : currentPathString
    );

    const [currentNode] = Editor.node(editor, path);

    setCurrentLatex(currentNode.latex);
    setSelectedElementID(currentNode.id);
    console.log(currentNode.id);

    // setSelectedElementID();
    setShowEditBlockPopup(true);
    const equationHeight = _element.offsetHeight;
    setDropdownEditBlockTop(targetRect.bottom + 60);
    setDropdownEditBlockLeft(targetRect.left + sideBarOffset);
  };

  const toggleRef = useRef<HTMLButtonElement>(null);
  const toggleEditBlockRef = useRef<HTMLElement>(null);

  const [addButtonHoveredId, setAddButtonHoveredId] = useState(null);

  const handleAddMCQBlock = useCallback((path: Path) => {
    const mcqNode = {
      id: genNodeId(),
      type: "mcq",
      children: [
        {
          id: genNodeId(),
          type: "list-item",
          children: [
            {
              text: "",
            },
          ],
        },
        {
          id: genNodeId(),
          type: "ol",
          children: [
            {
              id: genNodeId(),
              type: "option-list-item",
              children: [
                {
                  text: "",
                },
              ],
              correctAnswer: false,
            },
            {
              id: genNodeId(),
              type: "option-list-item",
              children: [
                {
                  text: "",
                },
              ],
              correctAnswer: true,
            },
          ],
        },
      ],
    };

    console.log("sfsdf");
    const [currentNode] = Editor.node(editor, path);
    const isEmptyNode =
      currentNode.type === "paragraph" &&
      currentNode.children.length === 1 &&
      currentNode.children[0].text === "";
    let newPath: Path;
    if (isEmptyNode) {
      Transforms.insertNodes(editor, mcqNode, { at: path });
      newPath = path;
    } else {
      Transforms.insertNodes(editor, mcqNode, { at: Path.next(path) });
      newPath = Path.next(path);
    }
    // Focus on the new list-item node
    const listItemPath = newPath.concat([0, 0]);
    const listItemPoint = { path: listItemPath, offset: 0 };
    Transforms.select(editor, listItemPoint);
    ReactEditor.focus(editor);
  }, []);

  const handleAddEditableEquationBlock = useCallback(
    (latex: string, path: Path) => {
      const equationId = genNodeId();

      const equationNode: CustomElement = {
        id: equationId,
        type: "equation",
        altText: "",
        latex,
        children: [{ text: "" }],
      };

      const [currentNode] = Editor.node(editor, path);
      const isEmptyNode =
        currentNode.type === "paragraph" &&
        currentNode.children.length === 1 &&
        currentNode.children[0].text === "";

      let newPath: Path;

      if (isEmptyNode) {
        Transforms.setNodes(editor, equationNode, { at: path });
        newPath = path;
        // Transforms.insertNodes(
        //   editor,
        //   { id: genNodeId(), type: "paragraph", children: [{ text: "" }] },
        //   { at: Path.next(path) }
        // );
      } else {
        Transforms.insertNodes(editor, equationNode, { at: Path.next(path) });
        newPath = Path.next(path);
      }

      const [insertedEquationNode] = Editor.nodes(editor, {
        at: newPath,
        match: (n) => n.type === "equation",
      });

      if (insertedEquationNode) {
        const { id } = insertedEquationNode[0] as CustomElement;
        const sideBarOffset = isLocked ? -150 : 0;
        console.log(id);
        setSelectedElementID(id);
        setShowEditBlockPopup(true);
        setactiveEditEquationPath(JSON.stringify(newPath));
        setCurrentLatex("");
        setTimeout(() => {
          const currentElement = document.querySelector(`[data-id="${id}"]`);
          console.log(currentElement);
          if (currentElement) {
            const targetRect = currentElement.getBoundingClientRect();
            setDropdownEditBlockLeft(targetRect.left + sideBarOffset);
            setDropdownEditBlockTop(targetRect.bottom + 60);
            console.log(targetRect.left);
          }
        }, 0);
      }
    },
    []
  );

  const renderElement = useCallback(
    (props) => {
      const { attributes, children, element } = props;

      const elementPath = ReactEditor.findPath(editor, element);
      const isRoot = elementPath.length === 1;

      if (!elementPath) return;

      const [parentElement, parentPath] = Editor.parent(editor, elementPath);
      const isInsideColumnCell = parentElement.type === "column-cell";
      const addButton =
        (isRoot && element.type !== "column" && element.type !== "title") ||
        isInsideColumnCell ? (
          <div
            className="z-1000 absolute top-1/2 left-0 -mt-5 flex h-10 w-10  cursor-pointer items-center justify-center"
            contentEditable={false}
          >
            {addButtonHoveredId === element.id && (
              <button
                className={`addButton rounded-md hover:bg-gray-200`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  console.log("addButton clicked");
                  openMiniDropdown(
                    event,
                    ReactEditor.findPath(editor, element)
                  );
                }}
                ref={toggleRef}
              >
                <Plus color={theme.colors.darkgray} />
              </button>
            )}
          </div>
        ) : null;

      const optionMenu =
        (isRoot && element.type === "mcq") || element.type === "equation" ? (
          <div className="absolute  top-1 right-5">
            <OptionMenu
              onClick={() => {
                console.log("something");
              }}
              element={element}
            />
          </div>
        ) : null;

      const shouldWrapWithSortableElement =
        (isRoot && element.type !== "column" && element.type !== "title") ||
        isInsideColumnCell;

      const content = shouldWrapWithSortableElement ? (
        <SortableElement
          {...props}
          renderElement={(props) => <ElementSelector {...props} />}
        />
      ) : (
        <ElementSelector {...props} />
      );

      return (
        <div
          className="group relative"
          onMouseEnter={() => setAddButtonHoveredId(element.id)}
          onMouseLeave={() => setAddButtonHoveredId(null)}
          onKeyDown={() => setAddButtonHoveredId(null)}
        >
          {content}
          {addButton}
          {optionMenu}
        </div>
      );
    },
    [addButtonHoveredId]
  );

  const [insertDirection, setInsertDirection] = useState(null);

  const handleDragEnd = useCallback(
    function (event) {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      // Find the nodes using their IDs
      setSelectedElementID(active.id);

      console.log("active", active.id, "over", over.id);
      const fromPath = findPathById(editor, active.id);
      const toPath = findPathById(editor, over.id);

      console.log("toPath", toPath);

      const [fromParentElement, fromParentPath] = Editor.parent(
        editor,
        fromPath
      );

      console.log(fromParentPath);
      const [toParentElement, toParentPath] = Editor.parent(editor, toPath);

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
        const targetPath =
          insertDirection === "left"
            ? toPath.slice(0, -1)
            : insertDirection === "right"
            ? toPath
            : toPath
                .slice(0, -1)
                .concat(toPath[toPath.length - 1] + toIndexOffset);

        createColumns(fromPath, { id: over.id, path: targetPath }, editor);
      } else if (
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
          columnElement.type === "column" &&
          columnElement.children.length === 1 &&
          columnElement.children[0]?.text === ""
        ) {
          Transforms.removeNodes(editor, { at: columnPath });
        }
      }

      // setCheckEmptyColumnCells((prevCheck) => !prevCheck);
      setActiveId("");
    },
    [editor, creatingNewColumn]
  );

  function Droppable({ children }) {
    const droppable = useDroppable({
      id: "droppable-area",
    });

    useDndMonitor({
      onDragOver(event) {
        const { active, over } = event;
        if (!over) {
          setCreatingNewColumn(false);
          setInsertDirection(null);
          return;
        }

        const activePath = findPathById(editor, active.id);
        const overPath = findPathById(editor, over.id);

        if (activePath && overPath) {
          const isNearRoot = activePath.length === 1 && overPath.length === 1;

          if (isNearRoot) {
            const overElement = document.querySelector(
              `[data-id="${over.id}"]`
            );

            if (!overElement) return;
            const overRect = overElement.getBoundingClientRect();

            const cursorX = event.delta.x;

            // const isCloseToLeft =
            //   cursorX < overRect.left + overRect.width * 0.5;
            const isCloseToRight =
              cursorX > overRect.left + overRect.width * 0.4;

            console.log(cursorX, overRect.left + overRect.width * 0.4);

            if (isCloseToRight) {
              setCreatingNewColumn(true);
              // setInsertDirection("right");
            } else {
              setCreatingNewColumn(false);
            }
          }
        } else {
          setCreatingNewColumn(false);
          setInsertDirection(null);
        }
      },
    });

    return (
      <div ref={droppable.setNodeRef} {...droppable.attributes}>
        {children}
      </div>
    );
  }

  const handleDragStart = useCallback(function ({ active }) {
    console.log(active.id);
    setActiveId(active.id);
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
        setShowEditBlockPopup(false);
        setactiveEditEquationPath(null);
      }
    },
    toggleEditBlockRef
  );

  const closeEditableDropdown = () => {
    if (showEditBlockPopup) {
      setShowEditBlockPopup(false);
      setactiveEditEquationPath(null);
    }
  };

  function handleEditorMouseUp(event, editor) {
    const equationElement = findAncestorWithClass(
      event.target,
      "equation-element"
    );
    if (equationElement) {
      const pathString = equationElement.getAttribute("data-path");
      if (pathString) {
        const path = JSON.parse(pathString);
        openEditBlockPopup(equationElement, event, path);
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

    const lastNode = editor.children[editor.children.length - 1];
    const lastNodePath = ReactEditor.findPath(editor, lastNode);

    if (lastNode.type === "equation") {
      insertNewParagraphBelowLastNode(lastNodePath);
      event.stopPropagation();
      return;
    }

    const lastNodeDOM = document.querySelector(
      `[data-path="${JSON.stringify(lastNodePath)}"]`
    );
    const lastNodeRect = lastNodeDOM.getBoundingClientRect();
    const clickedY = event.clientY;
    const isLastNodeEmpty =
      lastNode.children.length === 1 && lastNode.children[0].text === "";

    if (clickedY > lastNodeRect.bottom && !isLastNodeEmpty) {
      insertNewParagraphBelowLastNode(lastNodePath);
      event.stopPropagation();
    }
  }

  function insertNewParagraphBelowLastNode(lastNodePath) {
    const newParagraph = {
      id: genNodeId(),
      type: "paragraph",
      children: [{ text: "" }],
    };
    const newPath = lastNodePath
      .slice(0, -1)
      .concat(lastNodePath[lastNodePath.length - 1] + 1);
    Transforms.insertNodes(editor, newParagraph, { at: newPath });
    const leafNodePath = newPath.concat(0);
    Transforms.setSelection(editor, {
      anchor: { path: leafNodePath, offset: 0 },
      focus: { path: leafNodePath, offset: 0 },
    });
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

  return (
    <EditorProvider
      editor={editor}
      showEditBlockPopup={showEditBlockPopup}
      elementID={selectedElementID}
      setSelectedElementID={setSelectedElementID}
      activePath={activePath}
    >
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
              tabIndex={0}
              className="relative z-0 mx-auto block rounded-md pt-4 pr-1 pb-4 pl-2 focus:outline-none focus-visible:border-gray-300"
            >
              <Slate
                editor={editor}
                value={slatevalue}
                key={JSON.stringify(slatevalue)}
                onChange={(newValue) => {
                  // setValue(newValue);
                  if (handleTextChange) {
                    handleTextChange(newValue);
                  }
                }}
              >
                <Editable
                  className="relative h-[680px] overflow-y-auto"
                  renderElement={renderElement}
                  renderLeaf={Blank}
                  onKeyDown={handleKeyDown}
                  onMouseUp={(event) => handleEditorMouseUp(event, editor)}
                  onClick={(event) => handleCursorClick(event, editor)}
                />
                <Droppable>
                  <div></div>
                </Droppable>
              </Slate>
            </div>
          </ActiveElementProvider>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <DragOverlayContent
              element={findElementInSlateValue(slatevalue, activeId)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      <AnimatePresence>
        {showDropdown && activePath && (
          <motion.div
            {...y_animation_props}
            className="fixed left-[120px] z-10 mx-auto mt-2 w-[320px]"
            style={{
              top: `${dropdownTop}px`,
              left: `${dropdownLeft}px`,
            }}
          >
            <MiniDropdown
              ref={addSomethingDropdownRef}
              isOpen={showDropdown}
              addMCQBlock={() => {
                handleAddMCQBlock(JSON.parse(activePath));
                setShowDropdown(false);
              }}
              addEquationBlock={() => {
                handleAddEditableEquationBlock("", JSON.parse(activePath));
                setShowDropdown(false);
              }}
              genBlock={(_subject) => {
                console.log("add block");
                setShowFloatingModal({ open: true, subject: _subject });
                setShowDropdown(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showEditBlockPopup && activeEditEquationPath && (
          <>
            <motion.div
              {...y_animation_props}
              className="fixed  z-10 z-10 mx-auto mt-2 mt-2 w-[380px]"
              style={{
                top: `${dropdownEditBlockTop}px`,
                left: `${dropdownEditBlockLeft}px`,
              }}
            >
              <EditBlockPopup
                ref={editBlockDropdownRef}
                onChange={(latex, altText) =>
                  handleEditLatex(
                    latex,
                    altText,
                    JSON.parse(activeEditEquationPath)
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
                      children: [{ text: note }],
                    },
                    { at: Path.next(JSON.parse(activeEditEquationPath)) }
                  );
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {showFloatingModal.open && (
        <FloatingModal
          title={getModalTitle()}
          initialX={dropdownLeft}
          initialY={dropdownTop + 50}
          onClose={() => setShowFloatingModal({ open: false, subject: "" })}
        >
          {renderSubjectComponent()}
        </FloatingModal>
      )}
    </EditorProvider>
  );
};

export default DocumentEditor;
