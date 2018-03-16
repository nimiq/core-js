class GenesisConfig {
    static dev() {
        GenesisConfig.init(GenesisConfig.CONFIGS['dev']);
    }

    static bounty() {
        GenesisConfig.init(GenesisConfig.CONFIGS['bounty']);
    }

    /**
     * @param {{NETWORK_ID:number,NETWORK_NAME:string,GENESIS_BLOCK:Block,GENESIS_ACCOUNTS:string,SEED_PEERS:Array.<PeerAddress>}} config
     */
    static init(config) {
        if (GenesisConfig._config) throw new Error('GenesisConfig already initialized');
        if (!config.NETWORK_ID) throw new Error('Config is missing network id');
        if (!config.NETWORK_NAME) throw new Error('Config is missing database prefix');
        if (!config.GENESIS_BLOCK) throw new Error('Config is missing genesis block');
        if (!config.GENESIS_ACCOUNTS) throw new Error('Config is missing genesis accounts');
        if (!config.SEED_PEERS) throw new Error('Config is missing seed peers');

        GenesisConfig._config = config;
    }

    /**
     * @type {number}
     */
    static get NETWORK_ID() {
        if (!GenesisConfig._config) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._config.NETWORK_ID;
    }

    /**
     * @type {string}
     */
    static get NETWORK_NAME() {
        if (!GenesisConfig._config) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._config.NETWORK_NAME;
    }

    /**
     * @type {Block}
     */
    static get GENESIS_BLOCK() {
        if (!GenesisConfig._config) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._config.GENESIS_BLOCK;
    }

    /**
     * @type {Hash}
     */
    static get GENESIS_HASH() {
        if (!GenesisConfig._config) throw new Error('GenesisConfig not initialized');
        if (!GenesisConfig._config.GENESIS_HASH) {
            GenesisConfig._config.GENESIS_HASH = GenesisConfig._config.GENESIS_BLOCK.hash();
        }
        return GenesisConfig._config.GENESIS_HASH;
    }

    /**
     * @type {string}
     */
    static get GENESIS_ACCOUNTS() {
        if (!GenesisConfig._config) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._config.GENESIS_ACCOUNTS;
    }

    /**
     * @type {Array.<PeerAddress>}
     */
    static get SEED_PEERS() {
        if (!GenesisConfig._config) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._config.SEED_PEERS;
    }
}
Class.register(GenesisConfig);

GenesisConfig.CONFIGS = {
    // TODO 'main': { }
    // TODO 'test': { }

    'dev': {
        NETWORK_ID: 2,
        NETWORK_NAME: 'dev',
        SEED_PEERS: [
            WsPeerAddress.seed('dev.nimiq-network.com', 8080, 'e65e39616662f2c16d62dc08915e5a1d104619db8c2b9cf9b389f96c8dce9837')
        ],
        GENESIS_BLOCK: new Block(
            new BlockHeader(
                new Hash(null),
                new Hash(null),
                Hash.fromBase64('JvMr9c9l2m8HWNdFAGTEastKH+aDZvln9EopXelhVIg='),
                Hash.fromBase64('1t/Zm91tN0p178+ePcxyR5bPxvC6jFLskqiidFFO3wY='),
                BlockUtils.difficultyToCompact(1),
                1,
                1521242100,
                117462,
                BlockHeader.Version.V1),
            new BlockInterlink([], new Hash(null)),
            new BlockBody(Address.fromBase64('AAAAAAAAAAAAAAAAAAAAAAAAAAA='), [], BufferUtils.fromBase64('RGV2TmV0'))
        ),
        GENESIS_ACCOUNTS:
            'AGTHyaGKKYtMW9zm81Nw2UYCIWr2bQAAAAOO9hgWyh/5Ezv+1Ldw9Oid2zwaY+LjRXAjAQAAAdpxepGo' +
            'TVTy25Dj9WOZXg1SAyoCtCmEkgYAAAABAAAWgAAAAdpxepGoAAAB2nF6kagxFAXrnWawCibXmNIocpEN' +
            'bY2M4QAAAACPgR32bdaFsm6G5Bg4H96UDFtJMFclfA8rAQAAA+Z8YTcn7eJ7xhfBV9k79a2bDLpb0SWE' +
            'gSIAAAABAAALQAAAAKZqEDPcAAAD5nxhNyfiENwK3NNQGB6fxKS62kvoApoe4gEAAAKLbf59cM8P40JX' +
            'yIKzSkr749mOqp5n1/ruAAAAAQAAC0AAAABsklUU6AAAAott/n1wZs9N9eWbNeUSLDy5qbhe6CW7Q94B' +
            'AAADLsSIL0WLcA6Nt5Ji+Pu2j2p4wJgN8lpIVwAAAAEAABaAAAADLsSIL0UAAAMuxIgvRXGosRRWBkji' +
            'IyWOFAzp3WZYGhQvAAAAAN+ByO6LKclRKAD8iueyAPGY/ZnTIbM5CbUBAAAAMXEUVZ+h9Kb5BH+lzQTK' +
            'HdVMiFfmRsJBWAAAAAEAAAtAAAAACD2DY5sAAAAxcRRVn+hB476I0A6qQDjCSzzvumwsQHf9AQAAA03B' +
            '6LO6vHPfpZtbnDWtPlN7WlO0l+aw1KIAAAABAAALQAAAAIz1psifAAADTcHos7qSQrji3cQRvdhZEyJa' +
            'a9OF/pUTGwEAAAEJawwO04GTmnyPT2hcnepKTWwqUe3rBlVwAAAAAQAAC0AAAAAsPIICeQAAAQlrDA7T' +
            'Kd6Wv+nDz7vTAMDCu39sALbKiawBAAABJAr6aFtkUf/rcih9aUVHVigY+8UIy2/+QQAAAAEAAAtAAAAA' +
            'MKx/EWUAAAEkCvpoW4oaIYhRvV3BULo9azzYYyKeeCxrAQAAA03cDnJSDjUiPbhnHIY/7aooMW/Y0Epe' +
            'T58AAAABAAAWgAAAA03cDnJSAAADTdwOclKFF7HkvjRHt0g5nwPzP59X9Uge9wEAAAGGEgl7kg2aSBjn' +
            '4A5Od5+0Lh5sBpm6dar7AAAAAQAAFoAAAAGGEgl7kgAAAYYSCXuSk87IwlS6e4YT+koCY6/lL28D3sYB' +
            'AAACjIEYqGyFuGHIpbQDcibbuM8kkiHguhEKAwAAAAEAABaAAAACjIEYqGwAAAKMgRiobCUh+XSo0plb' +
            '6NrVoCXHLwt7XzNZAAAAA1fLvw67icCbQBBXoglPtPMRkeln1StoiSYAAAACFc2B9ywrb3evyXkRn2lI' +
            'r99+cUgwAipdwwEAAAPxDMrFsmKBEu04Bg6LEqHvrJj2ewKnZ3qmAAAAAQAAFoAAAAPxDMrFsgAAA/EM' +
            'ysWyc3iG9qZDzL/uCLJEdhmwKaAHgIMBAAACPUMNm/Uu1vSoi1gBseNjIp1mp154Sw79UAAAAAEAABaA' +
            'AAACPUMNm/UAAAI9Qw2b9YcCc88Iyrx0NUbMZOK3rJdc/ggmAQAAAnsptOZZhrhJa+5Z89rK+wkxjzUt' +
            'hAHVfDoAAAABAAAWgAAAAnsptOZZAAACeym05lkhopvGoZgAsJ38XeT+KI6VFZ6HVQEAAAKZNR0cZ3N/' +
            'V/VlAJ1g1vBkidPGJBfIBQZcAAAAAQAAC0AAAABu3i+EvAAAApk1HRxnwWGEqi7rwr6bZ9df8Uhr5cG3' +
            'nAUAAAAB+ett5xJRyHYmu80aIhgssCKeD9KYKNlI+gEAAAHcmaAZJKAMxD+5u1O+u5ALn65VT4HGDIxw' +
            'AAAAAQAAC0AAAABPbvAEMQAAAdyZoBkkTOyyimPzT9JghHBHVSBRqHTY6qMBAAABMiMv3v3Fqy0Rq/yO' +
            'BHu3RlPy/l121QrKAwAAAAEAABaAAAABMiMv3v0AAAEyIy/e/TyTgfm1ATlfv11vqgZ2mGgLp5I3AAAA' +
            'BB6+ivcGqPmcXVPR6jFzANQ/oHcfYAbWLCAAAAACEUzY24RQtw7fskPYnAuOCrVYvYWjy/Sq2QEAAAA1' +
            'ejIu8T103OAjQ6dOO7R1qdl9voiJTyMzAAAAAQAAC0AAAAAI6bMH0wAAADV6Mi7xMF78LO+AmQt47Q2F' +
            '8lJOtFmP+8sBAAADIrN3lvTLTPW10LenULSqINB8dhRMCjZoqgAAAAEAAAtAAAAAhciT7n4AAAMis3eW' +
            '9PfpWIeCkAqinftTYf+jyT/iAxE2AAAAACtXQrrG1ENyC6MF0IZJhxjw1atz1xqHhPwBAAAAvi3c14rV' +
            'Vkylvnz2LXDSnAd0Ap9o6EcHkwAAAAEAAAtAAAAAH7JPeUIAAAC+LdzXityvfksBfLlWNu3IzdEXOAKK' +
            'juLqAAAAAWKGyagmDA2tPlgh/4bnCAHEUTy6X43XlxYAAAABpZApuaLoMq3LP2zjV1NWvIyyZ9WXhbjK' +
            'rgAAAAOSnw31GpWdLCHuiuqqRiU+c6/7QpNNu415AQAAA/PO43ur9pEsqZCx+ctQ0uLZPiPcQtZ4AtoA' +
            'AAABAAALQAAAAKiiez9IAAAD887je6ty7kyqfDlYpexa6zO61+OPc7PemgEAAAFVhN0jTzdIVM9Xza9g' +
            'EHJEU/NTXLDe1iXFAAAAAQAAC0AAAAA463owjgAAAVWE3SNP895JOb/wZK4ieF/UWFZvxGiH5yMAAAAB' +
            'WtMtyhV1iFBda1GZC0OkOSwt9AADUTkavAEAAAGLTWokGsi+QGXG5VciJh0XKhgY2Ffw3nFhAAAAAQAA' +
            'C0AAAABB4jxbWgAAAYtNaiQaxyj4UkPRXmdB4RUJOmY0/+DGi2sAAAABmtptM00N3PW8TiZSDGq75w65' +
            'ENAqIvV17gEAAAPVauIkr0eeRNW8s9uvLImxBON8OZc+nrJLAAAAAQAAC0AAAACjkdBbcwAAA9Vq4iSv' +
            'LMTqFpsInyV7LXX07AVlLB4LwK8AAAACVOJQdF94lWhUD0pOtwPsSpOcOfVM4c3lYAEAAAJZhQlPED5v' +
            'd70C9VJcR9E0/6kVRjND3chpAAAAAQAAC0AAAABkQNbigwAAAlmFCU8Q5+bT5k92M+EdyU87fjVCIOHg' +
            'JvQBAAABLAh445G4HY/gCBp8Ww86DjZzqu2656S1WwAAAAEAABaAAAABLAh445EAAAEsCHjjkfGu/x1G' +
            'ALyflu5s6H/RjA0uF2FJAQAAAfUQ1yISxqLt9R+tekR4gPOI6gjm8GCCewkAAAABAAAWgAAAAfUQ1yIS' +
            'AAAB9RDXIhLmoPJPmFOfClWZtRtz8SIHZV+RYgEAAAGb6NZw6ik9LhWvYkCsjo753C4xml4yhuLkAAAA' +
            'AQAAFoAAAAGb6NZw6gAAAZvo1nDq0lWfSarsXeQhGik+Wy00hFQPYNIBAAAC4wlfg1nMx6ncdUeIXQp/' +
            'MHyEH0Q1GZoNiAAAAAEAAAtAAAAAeyw6leUAAALjCV+DWRJzvcMi6fQ+RMgH4p3thxoZkT3KAQAAAplo' +
            'xifaQHmEokpWgPZUy2JkLz0fIsjxIz4AAAABAAALQAAAAG7my7FPAAACmWjGJ9ojMPo7C9y8Ib/ncXPh' +
            'wUC60bh5vwAAAACNnQv2v4inBpnu2xVZInd7VAlMXKKdYgukAQAAApBN6CyLt+TdIz09e58DxUKFW4PK' +
            '6+lckmcAAAABAAALQAAAAG1iUVzCAAACkE3oLIs/W2vCON/csGZ+BrXXzOfPf3+nwgAAAABdcEFzteZa' +
            'aSm87wyRZwS2rvearhLJb0wSAQAAA5l3BvfWMZXszk+sOGOzYCH6Scso0530ACEAAAABAAAWgAAAA5l3' +
            'BvfWAAADmXcG99Yn1+CSxVm0b9VEmdXSPU9MLZ6euQEAAACc7CZPBZWabWnc3dRvBQIYMyDgLCyx2AtM' +
            'AAAAAQAAC0AAAAAaJ1u31wAAAJzsJk8FMsv+RNrEAeMhkxQQ7swlQm/MWcsBAAAEFqz9ZzfxBC8ZD/h5' +
            'XbP5/TW158EyNFjtDwAAAAEAAAtAAAAArnIqO98AAAQWrP1nN9WW44AbwcH3rC9B0LDZEGH/6LGWAAAA' +
            'A0/mTvNyq+e4MxN7UI6LWMDrHl4bIjVbRqkBAAAADwRE4OfGbkb1M4LvJTsug5Guwv4UipUglQAAAAEA' +
            'AAtAAAAAAoC2JXwAAAAPBETg5xXn4XxmjRL8H7qyrMKtPOQ68d9gAQAAA+kpJjZRO8ds5r5Z15bsaAvU' +
            'z1Hi+igym+wAAAABAAALQAAAAKbcMQkOAAAD6SkmNlFtNRkkOze3mxqbEGn8LmugDYG9AAEAAAIeKgo/' +
            '6Q3VK9Fh4+5mvtU/qnCGKcL5eZe6AAAAAQAAC0AAAABaXFcKpwAAAh4qCj/pVkOr82XeobTRYSqMwBit' +
            '+DK26L0AAAADExdE1KGweTGwMNtOUr0mkTMuJZPdUx/lFgEAAAIYnmRDO5Us7NZLbPKbfSqFz9Qcz12x' +
            'p7EIAAAAAQAAC0AAAABZb7tgigAAAhieZEM7QJBbpsW5TySU3AOaRq0w6StqDbkBAAAAQYtUtY+neTkG' +
            'p0FX3yBWlI9VfXL9rY2T0AAAAAEAABaAAAAAQYtUtY8AAABBi1S1j6CfjxyppAST/5j+yNsnpZ4mb+LM' +
            'AQAAAwd7a4MeZabvmCauqJUxc/dnJt9Qdbu0C+sAAAABAAALQAAAAIE/PJXbAAADB3trgx6XwCRFCATy' +
            '6PT5xzl/tTynPq+pVwEAAAP3RVI223cMsae0V7OPJkgsuqVbHiDuSfwpAAAAAQAAFoAAAAP3RVI22wAA' +
            'A/dFUjbbqciNZ2beiMn+kVcprmWvCo0qNNYAAAAAp/x8AiuP0gOSmGXc+PyW+ma3l4h07YsKpAEAAAKh' +
            'uMUSlEiZItBpeLfj6hIFvBR6t0/1Zyh2AAAAAQAAFoAAAAKhuMUSlAAAAqG4xRKUMbR0l40dlxXJiTEF' +
            'uHD29zmRDB8BAAAC0qDOUYnujJP0QRa7dQ2AJ0h1cIE0IkEehgAAAAEAABaAAAAC0qDOUYkAAALSoM5R' +
            'iepA5phgkMYQo9vghvEMs6W2EXiXAQAAAsKfyTSX6ZAOU+orXNxOz0wdBuAqVHbOiV0AAAABAAAWgAAA' +
            'AsKfyTSXAAACwp/JNJcBVoZ5gIarGpvmG5G4a1OXW3821QEAAANETmvLWBcBCeyCAd6ZLaV8GnQ8Da54' +
            'gAyrAAAAAQAAFoAAAANETmvLWAAAA0ROa8tY+JrQTn9k06PB7If9N0CfYchk/C0BAAACrhSVuS2ezk3S' +
            'ZrOTLlI6dWuGTC76mwagfAAAAAEAAAtAAAAAcljDnt0AAAKuFJW5LYlQAlhiQPsfkWnHfepiRbygaVcw' +
            'AQAAAbh/Gb8NJqE45Cy7l+FzX6ekgF3R/5Mtr+4AAAABAAAWgAAAAbh/Gb8NAAABuH8Zvw0P094GHr/6' +
            'AsV1AwxF7c61Qq2RSAAAAAJQwqsff2pLw8MLHSdj/TYI/vua9S1qFloyAQAAAZMy1gvR0p1S/3oRAOZ8' +
            'nDanLv73M3Fv150AAAABAAAWgAAAAZMy1gvRAAABkzLWC9F4DlJe82PbL79kI4++HW6Glhr8OAEAAAAc' +
            'Kk11+SFNxI4R9S/ebQHQO2V5jHpCMS1hAAAAAQAAC0AAAAAEsbeTqgAAABwqTXX5sSvBMuNoUTbS19Um' +
            'etiaDp8t/vsBAAABkaKnSL2M6hWXx8/DUkVUtGxAV3Xd9gtcfAAAAAEAABaAAAABkaKnSL0AAAGRoqdI' +
            'vTi9K8WL24O90wK1LIuwvNvkRR9iAQAAAQ5MDkLw77e4PHxSapULV3EHaCWnRV0ELfQAAAABAAAWgAAA' +
            'AQ5MDkLwAAABDkwOQvB45gZiCw5zStBMXeShepM6iLltkgAAAAHfl0LN8u7wC1h8uhyRIY5s1I1gZPfF' +
            '1qn+AAAAA8xCKTupigAMUEItvNB1XfJi5d20TA4oijkBAAABheDAya/Vr7/+aeXTjjrLIAY/8G9+ps7j' +
            'DAAAAAEAAAtAAAAAQPrKzEgAAAGF4MDJrySGgRI77yf0Ksrs7U5YU1v43lFrAAAAAkrmY2OrF77xscYd' +
            'oQqK/Kr8Sc5nR/w91goBAAADoIlPx03C0gM7wMgvzaUglns4BJzvq8fWUQAAAAEAABaAAAADoIlPx00A' +
            'AAOgiU/HTR059QJNJ6egySnjQ5ssU/g987fwAQAAAOSjwgS4txd+4xsScIOZ2jJ8gm6PFGb4IPcAAAAB' +
            'AAALQAAAACYbSwDKAAAA5KPCBLgEEiPQ5L80JKvaQkZUqVTQVFocRQEAAAAgrZivoOKiOJFwOp94dsp2' +
            'dceiRnJRp2BDAAAAAQAAC0AAAAAFckQdRgAAACCtmK+gCouuvquET79GQpJvlDjxodZmWlIBAAADdflm' +
            'IVtOxwzhUy9DP2U/1dg443ziW+44fAAAAAEAAAtAAAAAk6mRBZAAAAN1+WYhW7W78iEqRWPDm9L0+nV1' +
            'sgxvC7aAAAAAAnjT5GbwylWQC2KwtxExw7D10y49vKcooJ0AAAADf6VG1QRSW6oEqsV40bK3bkmqzoXd' +
            'ot6i4gEAAAEy6r22pwWExn95sjo6xoCdI0e/eYKD/GftAAAAAQAAFoAAAAEy6r22pwAAATLqvbanD5Iv' +
            '+2lMo8wGu38cLQnhQWGpZEoBAAAB3Wk4Pnb/keSDfMbiKmBGXEB/R75Sm81yZQAAAAEAABaAAAAB3Wk4' +
            'PnYAAAHdaTg+dlD3NG/nQX9YueouG07G0GevJx2cAQAAASDQ25ZqoHTmauLeC1uxbbJc9puYK7ibUGQA' +
            'AAABAAAWgAAAASDQ25ZqAAABINDblmrDxe/R9ACThqXry6xBd28gwzmBbAAAAAA3JtwFy7gOad2nnAuf' +
            '4c9a2JDr8h65bBqxAQAAApIfgNiYaB9nad26DD093xiYPxcQq2fLUB0AAAABAAALQAAAAG2v6s7EAAAC' +
            'kh+A2JhP0wpVAIQo7aaYGJz1q+BQ/JvaAQEAAAELaF0K71KfkeqRPM7T8QipPJ8FVXyve5YUAAAAAQAA' +
            'FoAAAAELaF0K7wAAAQtoXQrvJ/jj56GUsaHxN9mDMXP5RsX08l8AAAADE1QMtlVNL/Tr3lfTfZGZ4SRd' +
            '7Ko1EbsleAEAAAKN3l0bwt3bQiKYf+QXt0o8YjRC4DeZwDgRAAAAAQAAC0AAAABs+mTZ9gAAAo3eXRvC' +
            'VJEHZ0qy+F1pvTVulg0P1CdMCToAAAACfGL6o0cNbRO/RL5C/tljM1b4X9GibgKJhgEAAAPEPtTYFS70' +
            'hIR9vGG5Bss2KK0fyL/Q7ZfwAAAAAQAAFoAAAAPEPtTYFQAAA8Q+1NgVjxMxbNwbSqmxFnDEgA2J2Io6' +
            'Q14AAAAB0Fl8OgAV2mEYfjb3jRucPYtRg9szNOY5LAEAAADjj9fBEDJIdjKxmX0e1aiPEla5rtes80Lh' +
            'AAAAAQAAC0AAAAAl7U6gLgAAAOOP18EQBkYuU4gvkHTrVpgVrymqlmeIV3cBAAAA2NjC3v910c484H8c' +
            'iZmr9lYIo66SCeFyQwAAAAEAAAtAAAAAJCQgeoAAAADY2MLe/1PF67K3QcuQJ+m4P7tOiIrVmdFhAQAA' +
            'AukCHDJUZrnHmLoVULR6r8HDBaygNH/gNE8AAAABAAAWgAAAAukCHDJUAAAC6QIcMlS4diPveIAR8ciq' +
            'f6WfLVCvxGQ1MQAAAAJlQHbfixmoGC8hAefMDjnblFS989zLCxhKAQAAA+519/AhViOdiXDAAdtc5/ue' +
            'TM0syon8VYoAAAABAAAWgAAAA+519/AhAAAD7nX38CH0clyiOijE/jV+sOwm6ZB5i5GvYQEAAAGy/GNM' +
            'TQyzah076TeqMT+jyMJhGgese8vbAAAAAQAAC0AAAABIf2XiDQAAAbL8Y0xNr/JNzMvTszgQcqMcDBEz' +
            'tfKONfgAAAARpIlShW0='
    },

    'bounty': {
        NETWORK_ID: 3,
        NETWORK_NAME: 'bounty',
        SEED_PEERS: [
            WsPeerAddress.seed('bug-bounty1.nimiq-network.com', 8080, '7e825872ee12a71bda50cba9f230c760c84ee50eef0a3e435467e8d5307c0b4e'),
            WsPeerAddress.seed('bug-bounty2.nimiq-network.com', 8080, 'ea876175c8b693c0db38b7c17d66e9c510020fceb4634f04e281af30438f8787'),
            WsPeerAddress.seed('bug-bounty3.nimiq-network.com', 8080, '5c0d5d801e85ebd42f25a45b2cb7f3b39b9ce14002d4662f5ed0cd79ce25165a')
        ],
        GENESIS_BLOCK: new Block(
            new BlockHeader(
                new Hash(null),
                new Hash(null),
                Hash.fromBase64('giOIYTBojKQPmBLq5msCgObOL3KnQ9CKrIGb5HWz7E8='),
                Hash.fromBase64('xexmOOk+2oLBIhwkCD+caw2FsifB0U6tXlles8Tycts='),
                BlockUtils.difficultyToCompact(1),
                1,
                0,
                104295,
                BlockHeader.Version.V1),
            new BlockInterlink([], new Hash(null)),
            new BlockBody(Address.fromBase64('AAAAAAAAAAAAAAAAAAAAAAAAAAA='), [])
        ),
        GENESIS_ACCOUNTS: 'AAIP7R94Gl77Xrk4xvszHLBXdCzC9AAAAHKYqT3gAAh2jadJcsL852C50iDDRIdlFjsNAAAAcpipPeAA'
    }
};
