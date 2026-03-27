export function createOperationsRegistry() {
    const allOperations = [];
    function buildTree(operations) {
        const root = { name: "ink-mirror" };
        for (const op of operations) {
            const { root: rootName, feature } = op.hierarchy;
            if (!root.children)
                root.children = {};
            if (!root.children[rootName]) {
                root.children[rootName] = { name: rootName };
            }
            const rootNode = root.children[rootName];
            if (!rootNode.children)
                rootNode.children = {};
            if (!rootNode.children[feature]) {
                rootNode.children[feature] = { name: feature };
            }
            const featureNode = rootNode.children[feature];
            if (!featureNode.operations)
                featureNode.operations = [];
            featureNode.operations.push(op);
        }
        return root;
    }
    return {
        register(operations) {
            allOperations.push(...operations);
        },
        getAll() {
            return [...allOperations];
        },
        getTree() {
            return buildTree(allOperations);
        },
        findByPath(segments) {
            const tree = buildTree(allOperations);
            let current = tree;
            for (const segment of segments) {
                current = current?.children?.[segment];
                if (!current)
                    return undefined;
            }
            return current;
        },
    };
}
