export const solvers = {
    "0xd31e0ce8154da6b8086d961eb3068ef74c4322b6": "Gnosis 0x API",
    "0x6566692e5e7fc9a3559d539488c55c1570a6bd2f": "Bepop",
    "0x6bf97afe2d2c790999cded2a8523009eb8a0823f": "Portus",
    "0x4cdba844ceb949567ea18b9ef185515fa626c69d": "Helixbox",
    "0x9cf49541f8b94da501cd16b60fa176d856fb1e75": "Sector Finance",
    "0xaa224676d096b6fc257f8c386c67d9e96e53ad59": "Gnosis BalancerSOR",
    "0x09498cf3414616c1d58979fce65438473c998c47": "Wraxyn",
    "0x65e80731f97b8361e77670357d287266dd0d93b6": "Apollo",
    "0xadf619eb586e7b3586ba5f45a6086d64b8f1dcaa":"ExtQuasimodo",
    "0x4dd1be0cd607e5382dd2844fa61d3a17e3e83d56": "Rizzolver",
    "0xa8d8613ec7cbe23c506ef5f293d570945b988cb9": "Arctic",
    "0xba36cefb45d1cdd2ae30a899c432c5081e095ff8": "Baseline"

}

/**
 * Get the solver name for a given address, or return the address if no mapping exists
 * @param address - The solver address
 * @returns The solver name or the original address if not found
 */
export const getSolverName = (address: string): string => {
    const normalizedAddress = address.toLowerCase();
    return solvers[normalizedAddress as keyof typeof solvers] || address;
}