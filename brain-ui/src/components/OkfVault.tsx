import React, { useEffect } from 'react';
import { Modal, Tree, Tag, Empty, message } from 'antd';
import { FolderOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import { useBrainStore } from '../store/brainStore';

export function OkfVault() {
  const isVaultOpen = useBrainStore((s) => s.isVaultOpen);
  const setVaultOpen = useBrainStore((s) => s.setVaultOpen);
  const vaultTree = useBrainStore((s) => s.vaultTree);
  const fetchVault = useBrainStore((s) => s.fetchVault);
  const restoreMemory = useBrainStore((s) => s.restoreMemory);

  useEffect(() => {
    if (isVaultOpen) {
      fetchVault();
    }
  }, [isVaultOpen]);

  // Convert backend tree format to Ant Design Tree format
  const treeData = vaultTree.map((item: any) => ({
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

  const handleRestore = async (key: string) => {
    // Extract memory_id from the file path (e.g., "PSX/12345678-1234-1234-1234-123456789abc.md")
    const parts = key.split('/');
    const fileName = parts[parts.length - 1];
    const memoryId = fileName.replace('.md', '');
    
    try {
      await restoreMemory(memoryId);
      message.success(`Restored memory ${memoryId.slice(0, 8)}...`);
    } catch (err) {
      message.error('Failed to restore memory');
    }
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
