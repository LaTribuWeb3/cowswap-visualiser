/**
 * Solver name mappings
 * Maps solver addresses to their human-readable names
 */
export const SOLVERS: Record<string, string> = {
    '0x0ddcb0769a3591230caa80f85469240b71442089': 'Seasolver',
    '0xd2adf24253056d45731a8561749fc9b2ffa4fe19': 'Apollo',
    '0x95480d3f27658e73b2785d30beb0c847d78294c7': 'Fractal',
    '0xe31267f42cf47a87ecc9e818b4db80168a4c84a1': 'Arctic',
    '0xdfddadd85fe5a8a0943a2dd263f8fe5302a7d027': 'Unizen',
    '0x2224eaacc7c2dbf85d5355bab9e9271e01d30b55': 'Sector_Finance',
    '0xa7842153fde380a864726d0e91f14f6ffab7d46c': 'Wraxyn',
    '0x1b99451f62a8574f8413f5a3fc80b99b29701c16': 'PLM',
    '0x04b89dbce06e7aa2f4bba78969add4576eb94788': 'ApeOut',
    '0xb9332b6301e5983272c30dd5b48a4e3b1664511b': 'Baseline',
    '0x42cb97c2695cf6227c3a1323a1942089abc9716b': 'Elfomo',
    '0xa60ded4c899e7560dc4ca56b57fbab25c90addeb': 'Helixbox',
    '0xa883710b6dbf008a1cc25722c54583e35884a209': 'Horadrim',
    '0xe3067c7c27c1038de4e8ad95a83b927d23dfbd99': 'PLM',
    '0xc9f2e6ea1637e499406986ac50ddc92401ce1f58': 'PropellerSwap',
    '0xd50ecb485dcf5d97266122dfed979587dd8923ac': 'Gnosis_Balancer',
    '0xc7899ff6a3ac2ff59261bd960a8c880df06e1041': 'Barter',
    '0x1921e0ff550c09066edd4df05d304151c45e77de': 'Barter',
    '0xa97851357e99082762c972f794b2a29e629511a7': 'Prycto',
    '0x9528e8c42f7e109baded964e2d927fd5b6ca71e9': 'Odos',
    '0x8f70a86c1309D8b1f5BefC58948E7386fd495875': 'Tsolver',
    '0x4339889fd9dfca20a423fba011e9dff1c856caeb': 'GlueX_Protocol',
    '0x28b1bd44996105b5c14c4de41093226ff78a4eb1': '0x',
    '0x00806daa2cfe49715ea05243ff259deb195760fc': 'Quasilabs',
    '0x4dd1be0cd607e5382dd2844fa61d3a17e3e83d56': 'Rizzolver',
    '0x6bf97afe2d2c790999cded2a8523009eb8a0823f': 'Portus',
    '0xa9d635ef85bc37eb9ff9d6165481ea230ed32392': 'Quasi',
};

/**
 * Get solver name from address
 * Returns the solver name if found in mapping, otherwise returns null
 * @param address - The solver address
 * @returns The solver name or null if not found
 */
export function getSolverName(address: string): string | null {
    // Normalize address to lowercase for comparison
    const normalizedAddress = address.toLowerCase();
    return SOLVERS[normalizedAddress] || null;
}

/**
 * Format solver display
 * Returns solver name if known, otherwise returns formatted address
 * @param address - The solver address
 * @param formatAddressFn - Optional function to format addresses
 * @returns The solver display string
 */
export function formatSolverDisplay(
    address: string, 
    formatAddressFn?: (addr: string) => string
): string {
    const solverName = getSolverName(address);
    if (solverName) {
        return solverName;
    }
    
    // If no name found and we have a format function, use it
    if (formatAddressFn) {
        return formatAddressFn(address);
    }
    
    // Default formatting
    if (!address || address.length < 10) return address || 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

