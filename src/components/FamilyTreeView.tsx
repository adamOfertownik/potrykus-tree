"use client";

import type { Person } from "@/types/family";
import type { TreeNode } from "@/lib/tree";
import { PersonCard } from "@/components/PersonCard";

type Props = {
  node: TreeNode;
  focusId?: string;
  onSelect?: (id: string) => void;
};

function CoupleBlock({
  person,
  spouses,
  onSelect,
  focusId,
}: {
  person: Person;
  spouses: Person[];
  onSelect?: (id: string) => void;
  focusId?: string;
}) {
  const spouse = spouses[0];
  return (
    <div className="tree-couple">
      <div
        className={`tree-node-wrap${focusId === person.id ? " is-focus" : ""}`}
      >
        <PersonCard
          person={person}
          compact
          href={`/osoba/${person.id}`}
          onClick={() => onSelect?.(person.id)}
        />
      </div>
      {spouse && (
        <>
          <div className="tree-spouse-line" aria-hidden />
          <div
            className={`tree-node-wrap${focusId === spouse.id ? " is-focus" : ""}`}
          >
            <PersonCard
              person={spouse}
              compact
              href={`/osoba/${spouse.id}`}
              onClick={() => onSelect?.(spouse.id)}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function FamilyTreeBranch({ node, focusId, onSelect }: Props) {
  const hasChildren = node.children.length > 0;

  return (
    <div className="tree-branch">
      <CoupleBlock
        person={node.person}
        spouses={node.spouses}
        onSelect={onSelect}
        focusId={focusId}
      />
      {hasChildren && (
        <div className="tree-descendants">
          <div className="tree-stem" aria-hidden />
          <div className="tree-children">
            {node.children.map((child) => (
              <div key={child.person.id} className="tree-child">
                <div className="tree-child-connector" aria-hidden />
                <FamilyTreeBranch
                  node={child}
                  focusId={focusId}
                  onSelect={onSelect}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FamilyTreeView({
  root,
  focusId,
  onSelect,
}: {
  root: TreeNode;
  focusId?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="tree-canvas" id="family-tree-canvas">
      <FamilyTreeBranch node={root} focusId={focusId} onSelect={onSelect} />
    </div>
  );
}
