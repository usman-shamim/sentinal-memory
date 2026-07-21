import React, { useEffect, useState } from 'react';
import { Modal, Tree, Tag, Empty, message } from 'antd';
import { FolderOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import { useBrainStore } from '../store/brainStore';
import axios from 'axios';

interface TreeNode {
  title: string;
  key: string;
  icon?: React.ReactNode;
  children?: TreeNode[];
  isLeaf?: boolean;
}

export function OkfVault() {
  const isVaultOpen = useBrainStore((s) => s.isVaultOpen);
  const setVaultOpen = useBrainStore((s) => s.setVaultOpen);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVaultOpen) {
      fetchVault();
    }
  }, [isVaultOpen]);

  const fetchVault = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:8400/vault', {
        params: { project: 'agent-launch-pad' },
      });
      
      // Convert backend tree format to Ant Design Tree format
      const tree: TreeNode[] = (res.data.tree || []).map((item: any) => ({
        title: item.title,
        key: item.key,
        icon: <FolderOutlined className="text-yellow-500" />,
        children: (item.children || []).map((child: any) => ({
          title: child.title,
          key: child.key,
          icon: <FileTextOutlined className="text-gray-400" />,
          isLeaf: true,
        })),
      }));
      
      setTreeData(tree);
    } catch (err) {
      console.error('Failed to fetch vault:', err);
    }
    setLoading(false);
  };

  const handleRestore = (key: string) => {
    message.success(`Restoring memory to active status...`);
    // In production: axios.post('http://localhost:8400/restore', { memory_id: key })
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <span>Externalized Brain (OKF Archive)</span>
          <Tag color="default">{treeData.length} categories</Tag>
        </div>
      }
      open={isVaultOpen}
      onCancel={() => setVaultOpen(false)}
      footer={null}
      width={600}
      styles={{ content: { background: '#0a0a0a' } }}
    >
      <p className="text-gray-400 text-xs mb-4">
        These memories have decayed below the 0.05 threshold. They are forgotten by active agents but preserved on disk as OKF v0.1 bundles.
      </p>

      {treeData.length > 0 ? (
        <Tree
          showIcon
          treeData={treeData}
          defaultExpandAll
          titleRender={(node: any) => (
            <div className="flex justify-between items-center w-full pr-4 group">
              <span className="text-sm">{node.title}</span>
              {node.isLeaf && (
                <Tag
                  color="purple"
                  className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  icon={<ReloadOutlined />}
                  onClick={() => handleRestore(node.key)}
                >
                  Restore
                </Tag>
              )}
            </div>
          )}
        />
      ) : (
        <Empty description="No archived memories yet" />
      )}
    </Modal>
  );
}
