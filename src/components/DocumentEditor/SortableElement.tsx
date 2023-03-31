// import { React, useSortable, CSS, classNames } from "../deps";
import { useActiveElement } from "@/contexts/ActiveElementContext";

import { ReactEditor, useReadOnly } from "slate-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import classes from "./styles/SortableElement.module.css";
import { default as classNames } from "classnames";
import { GripVertical } from "lucide-react";
import { useTheme } from "styled-components";
import { EquationContext } from "@/contexts/EquationEditContext";
import React, { useContext, useMemo } from "react";
import { Editor } from "slate";
import { useNewColumn } from "@/contexts/NewColumnContext";

const SortableHandle = ({ setActivatorNodeRef, listeners, color, width }) => (
  <div className="flex w-[60px] justify-end">
    <button
      ref={setActivatorNodeRef}
      {...listeners}
      className={classes.handle}
      contentEditable={false}
    >
      <GripVertical color={color} width={width} />
    </button>
  </div>
);

export function SortableElement({
  attributes,
  children,
  element,
  renderElement,
}) {
  const { activeIndex } = useActiveElement();
  const readOnly = useReadOnly();

  const theme = useTheme();

  const { creatingNewColumn } = useNewColumn();

  const {
    attributes: sortableAttributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    over,
    index,
    isSorting,
    isDragging,
  } = useSortable({ id: element.id });

  const showCreateNewColumnLeft =
    creatingNewColumn && over?.id !== element.id && index < activeIndex;
  const showCreateNewColumnRight =
    creatingNewColumn && over?.id !== element.id && index > activeIndex;

  return (
    <div>
      <div
        className={classNames(
          classes.sortableElement,
          isDragging && classes.active
        )}
        ref={setNodeRef}
        {...sortableAttributes}
        style={{
          transition,
          transform: isSorting ? undefined : CSS.Transform.toString(transform),
        }}
      >
        {readOnly ? null : (
          <div className="flex w-[60px] justify-end">
            <button
              ref={setActivatorNodeRef}
              {...listeners}
              className={classes.handle}
              contentEditable={false}
            >
              <GripVertical color={theme.colors.darkgray} width={20} />
            </button>
          </div>
        )}
        <div
          className={classNames(
            classes.elementWrapper,
            over?.id === element.id
              ? index > activeIndex
                ? classes.insertAfter
                : classes.insertBefore
              : undefined,
            showCreateNewColumnRight && classes.createNewColumnRight,
            showCreateNewColumnLeft && classes.createNewColumnLeft
          )}
        >
          {renderElement({ attributes, children, element })}
        </div>
      </div>
    </div>
  );
}
