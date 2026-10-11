// scripts/build-reference-db.js
// Curates authentic reference sequences from NCBI RefSeq and generates chunked database
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data/reference');

// Curated authentic reference registry metadata
const REGISTRY = [
  // --- BACTERIA 16S ---
  {
    category: 'bacteria/16s',
    indexName: 'bacteria-16s-index.json',
    chunkName: 'bacteria-16s-a.json',
    marker: '16S rRNA',
    domain: 'Bacteria',
    records: [
      {
        id: 'ref-bac-16s-ecoli',
        accession: 'NR_024570.1',
        organism: 'Escherichia coli',
        scientificName: 'Escherichia coli',
        species: 'coli',
        genus: 'Escherichia',
        family: 'Enterobacteriaceae',
        order: 'Enterobacterales',
        class: 'Gammaproteobacteria',
        phylum: 'Pseudomonadota',
        kingdom: 'Bacteria',
        domain: 'Bacteria',
        marker: '16S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Type Strain / Reference Genome'
      },
      {
        id: 'ref-bac-16s-bsubtilis',
        accession: 'NR_102783.2',
        organism: 'Bacillus subtilis',
        scientificName: 'Bacillus subtilis subsp. subtilis',
        species: 'subtilis',
        genus: 'Bacillus',
        family: 'Bacillaceae',
        order: 'Bacillales',
        class: 'Bacilli',
        phylum: 'Bacillota',
        kingdom: 'Bacteria',
        domain: 'Bacteria',
        marker: '16S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Type Strain 168'
      },
      {
        id: 'ref-bac-16s-saureus',
        accession: 'NR_118997.2',
        organism: 'Staphylococcus aureus',
        scientificName: 'Staphylococcus aureus subsp. aureus',
        species: 'aureus',
        genus: 'Staphylococcus',
        family: 'Staphylococcaceae',
        order: 'Bacillales',
        class: 'Bacilli',
        phylum: 'Bacillota',
        kingdom: 'Bacteria',
        domain: 'Bacteria',
        marker: '16S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain NCTC 8325'
      },
      {
        id: 'ref-bac-16s-paeruginosa',
        accession: 'NR_117678.1',
        organism: 'Pseudomonas aeruginosa',
        scientificName: 'Pseudomonas aeruginosa',
        species: 'aeruginosa',
        genus: 'Pseudomonas',
        family: 'Pseudomonadaceae',
        order: 'Pseudomonadales',
        class: 'Gammaproteobacteria',
        phylum: 'Pseudomonadota',
        kingdom: 'Bacteria',
        domain: 'Bacteria',
        marker: '16S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Type Strain DSM 50071'
      },
      {
        id: 'ref-bac-16s-senterica',
        accession: 'NR_074910.1',
        organism: 'Salmonella enterica',
        scientificName: 'Salmonella enterica subsp. enterica serovar Typhimurium',
        species: 'enterica',
        genus: 'Salmonella',
        family: 'Enterobacteriaceae',
        order: 'Enterobacterales',
        class: 'Gammaproteobacteria',
        phylum: 'Pseudomonadota',
        kingdom: 'Bacteria',
        domain: 'Bacteria',
        marker: '16S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain LT2'
      },
      {
        id: 'ref-bac-16s-mtuberculosis',
        accession: 'NR_102810.1',
        organism: 'Mycobacterium tuberculosis',
        scientificName: 'Mycobacterium tuberculosis',
        species: 'tuberculosis',
        genus: 'Mycobacterium',
        family: 'Mycobacteriaceae',
        order: 'Mycobacteriales',
        class: 'Actinomycetia',
        phylum: 'Actinomycetota',
        kingdom: 'Bacteria',
        domain: 'Bacteria',
        marker: '16S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain H37Rv'
      },
      {
        id: 'ref-bac-16s-lacidophilus',
        accession: 'NR_074987.1',
        organism: 'Lactobacillus acidophilus',
        scientificName: 'Lactobacillus acidophilus',
        species: 'acidophilus',
        genus: 'Lactobacillus',
        family: 'Lactobacillaceae',
        order: 'Lactobacillales',
        class: 'Bacilli',
        phylum: 'Bacillota',
        kingdom: 'Bacteria',
        domain: 'Bacteria',
        marker: '16S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Type Strain NCFM'
      },
      {
        id: 'ref-bac-16s-vcholerae',
        accession: 'NR_074805.1',
        organism: 'Vibrio cholerae',
        scientificName: 'Vibrio cholerae O1 biovar El Tor',
        species: 'cholerae',
        genus: 'Vibrio',
        family: 'Vibrionaceae',
        order: 'Vibrionales',
        class: 'Gammaproteobacteria',
        phylum: 'Pseudomonadota',
        kingdom: 'Bacteria',
        domain: 'Bacteria',
        marker: '16S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain N16961'
      }
    ]
  },

  // --- ARCHAEA 16S ---
  {
    category: 'archaea/16s',
    indexName: 'archaea-16s-index.json',
    chunkName: 'archaea-16s-a.json',
    marker: '16S rRNA (Archaeal)',
    domain: 'Archaea',
    records: [
      {
        id: 'ref-arc-16s-mjannaschii',
        accession: 'NR_028169.1',
        organism: 'Methanocaldococcus jannaschii',
        scientificName: 'Methanocaldococcus jannaschii',
        species: 'jannaschii',
        genus: 'Methanocaldococcus',
        family: 'Methanocaldococcaceae',
        order: 'Methanococcales',
        class: 'Methanococci',
        phylum: 'Methanobacteriota',
        kingdom: 'Archaea',
        domain: 'Archaea',
        marker: '16S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Type Strain DSM 2661'
      },
      {
        id: 'ref-arc-16s-hsalinarum',
        accession: 'NR_074218.1',
        organism: 'Halobacterium salinarum',
        scientificName: 'Halobacterium salinarum',
        species: 'salinarum',
        genus: 'Halobacterium',
        family: 'Halobacteriaceae',
        order: 'Halobacteriales',
        class: 'Halobacteria',
        phylum: 'Halobacteriota',
        kingdom: 'Archaea',
        domain: 'Archaea',
        marker: '16S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain NRC-1'
      },
      {
        id: 'ref-arc-16s-sacidocaldarius',
        accession: 'NR_074272.1',
        organism: 'Sulfolobus acidocaldarius',
        scientificName: 'Sulfolobus acidocaldarius',
        species: 'acidocaldarius',
        genus: 'Sulfolobus',
        family: 'Sulfolobaceae',
        order: 'Sulfolobales',
        class: 'Thermoprotei',
        phylum: 'Thermoproteota',
        kingdom: 'Archaea',
        domain: 'Archaea',
        marker: '16S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Type Strain DSM 639'
      },
      {
        id: 'ref-arc-16s-mthermautotrophicus',
        accession: 'NR_074230.1',
        organism: 'Methanothermobacter thermautotrophicus',
        species: 'thermautotrophicus',
        scientificName: 'Methanothermobacter thermautotrophicus',
        genus: 'Methanothermobacter',
        family: 'Methanobacteriaceae',
        order: 'Methanobacteriales',
        class: 'Methanobacteria',
        phylum: 'Methanobacteriota',
        kingdom: 'Archaea',
        domain: 'Archaea',
        marker: '16S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain Delta H'
      }
    ]
  },

  // --- FUNGI ITS ---
  {
    category: 'fungi/its',
    indexName: 'fungi-its-index.json',
    chunkName: 'fungi-its-a.json',
    marker: 'ITS1-5.8S-ITS2',
    domain: 'Eukaryota',
    records: [
      {
        id: 'ref-fun-its-scerevisiae',
        accession: 'NR_111007.1',
        organism: 'Saccharomyces cerevisiae',
        scientificName: 'Saccharomyces cerevisiae',
        species: 'cerevisiae',
        genus: 'Saccharomyces',
        family: 'Saccharomycetaceae',
        order: 'Saccharomycetales',
        class: 'Saccharomycetes',
        phylum: 'Ascomycota',
        kingdom: 'Fungi',
        domain: 'Eukaryota',
        marker: 'ITS1-5.8S-ITS2',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain S288C'
      },
      {
        id: 'ref-fun-its-calbicans',
        accession: 'NR_125332.1',
        organism: 'Candida albicans',
        scientificName: 'Candida albicans',
        species: 'albicans',
        genus: 'Candida',
        family: 'Debaryomycetaceae',
        order: 'Saccharomycetales',
        class: 'Saccharomycetes',
        phylum: 'Ascomycota',
        kingdom: 'Fungi',
        domain: 'Eukaryota',
        marker: 'ITS1-5.8S-ITS2',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain SC5314'
      },
      {
        id: 'ref-fun-its-ctropicalis',
        accession: 'NR_130691.1',
        organism: 'Candida tropicalis',
        scientificName: 'Candida tropicalis',
        species: 'tropicalis',
        genus: 'Candida',
        family: 'Debaryomycetaceae',
        order: 'Saccharomycetales',
        class: 'Saccharomycetes',
        phylum: 'Ascomycota',
        kingdom: 'Fungi',
        domain: 'Eukaryota',
        marker: 'ITS1-5.8S-ITS2',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Type Strain ATCC 750'
      },
      {
        id: 'ref-fun-its-aniger',
        accession: 'NR_135338.1',
        organism: 'Aspergillus niger',
        scientificName: 'Aspergillus niger',
        species: 'niger',
        genus: 'Aspergillus',
        family: 'Aspergillaceae',
        order: 'Eurotiales',
        class: 'Eurotiomycetes',
        phylum: 'Ascomycota',
        kingdom: 'Fungi',
        domain: 'Eukaryota',
        marker: 'ITS1-5.8S-ITS2',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain CBS 513.88'
      },
      {
        id: 'ref-fun-its-pchrysogenum',
        accession: 'NR_121224.1',
        organism: 'Penicillium chrysogenum',
        scientificName: 'Penicillium chrysogenum',
        species: 'chrysogenum',
        genus: 'Penicillium',
        family: 'Aspergillaceae',
        order: 'Eurotiales',
        class: 'Eurotiomycetes',
        phylum: 'Ascomycota',
        kingdom: 'Fungi',
        domain: 'Eukaryota',
        marker: 'ITS1-5.8S-ITS2',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain Wisconsin 54-1255'
      },
      {
        id: 'ref-fun-its-cneoformans',
        accession: 'NR_121473.1',
        organism: 'Cryptococcus neoformans',
        scientificName: 'Cryptococcus neoformans var. grubii',
        species: 'neoformans',
        genus: 'Cryptococcus',
        family: 'Cryptococcaceae',
        order: 'Tremellales',
        class: 'Tremellomycetes',
        phylum: 'Basidiomycota',
        kingdom: 'Fungi',
        domain: 'Eukaryota',
        marker: 'ITS1-5.8S-ITS2',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain H99'
      }
    ]
  },

  // --- EUKARYOTES 18S ---
  {
    category: 'eukaryotes/18s',
    indexName: 'eukaryotes-18s-index.json',
    chunkName: 'eukaryotes-18s-a.json',
    marker: '18S rRNA',
    domain: 'Eukaryota',
    records: [
      {
        id: 'ref-euk-18s-tthermophila',
        accession: 'NR_044700.1',
        organism: 'Tetrahymena thermophila',
        scientificName: 'Tetrahymena thermophila',
        species: 'thermophila',
        genus: 'Tetrahymena',
        family: 'Tetrahymenidae',
        order: 'Tetrahymenida',
        class: 'Oligohymenophorea',
        phylum: 'Ciliophora',
        kingdom: 'Chromista',
        domain: 'Eukaryota',
        marker: '18S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain'
      },
      {
        id: 'ref-euk-18s-ddiscoideum',
        accession: 'NR_074895.1',
        organism: 'Dictyostelium discoideum',
        scientificName: 'Dictyostelium discoideum',
        species: 'discoideum',
        genus: 'Dictyostelium',
        family: 'Dictyosteliaceae',
        order: 'Dictyosteliales',
        class: 'Dictyostelea',
        phylum: 'Amoebozoa',
        kingdom: 'Protozoa',
        domain: 'Eukaryota',
        marker: '18S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain AX4'
      },
      {
        id: 'ref-euk-18s-ptetraurelia',
        accession: 'NR_044690.1',
        organism: 'Paramecium tetraurelia',
        scientificName: 'Paramecium tetraurelia',
        species: 'tetraurelia',
        genus: 'Paramecium',
        family: 'Parameciidae',
        order: 'Peniculida',
        class: 'Oligohymenophorea',
        phylum: 'Ciliophora',
        kingdom: 'Chromista',
        domain: 'Eukaryota',
        marker: '18S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain'
      }
    ]
  },

  // --- ALGAE ---
  {
    category: 'algae',
    indexName: 'algae-index.json',
    chunkName: 'algae-a.json',
    marker: '18S rRNA / Plastid',
    domain: 'Eukaryota',
    records: [
      {
        id: 'ref-alg-18s-creinhardtii',
        accession: 'NR_115668.1',
        organism: 'Chlamydomonas reinhardtii',
        scientificName: 'Chlamydomonas reinhardtii',
        species: 'reinhardtii',
        genus: 'Chlamydomonas',
        family: 'Chlamydomonadaceae',
        order: 'Chlamydomonadales',
        class: 'Chlorophyceae',
        phylum: 'Chlorophyta',
        kingdom: 'Plantae',
        domain: 'Eukaryota',
        marker: '18S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain CC-125'
      },
      {
        id: 'ref-alg-18s-cvulgaris',
        accession: 'NR_044780.1',
        organism: 'Chlorella vulgaris',
        scientificName: 'Chlorella vulgaris',
        species: 'vulgaris',
        genus: 'Chlorella',
        family: 'Chlorellaceae',
        order: 'Chlorellales',
        class: 'Trebouxiophyceae',
        phylum: 'Chlorophyta',
        kingdom: 'Plantae',
        domain: 'Eukaryota',
        marker: '18S rRNA',
        source: 'NCBI RefSeq Targeted Loci',
        referenceStatus: 'Reference Strain CCAP 211/11B'
      }
    ]
  },

  // --- VIRUSES ---
  {
    category: 'viruses',
    indexName: 'viruses-index.json',
    chunkName: 'viruses-a.json',
    marker: 'Viral Genome / Diagnostic Region',
    domain: 'Viruses',
    records: [
      {
        id: 'ref-vir-sars2',
        accession: 'NC_045512.2',
        organism: 'Severe acute respiratory syndrome coronavirus 2',
        scientificName: 'Severe acute respiratory syndrome coronavirus 2',
        species: 'Severe acute respiratory syndrome-related coronavirus',
        genus: 'Betacoronavirus',
        family: 'Coronaviridae',
        order: 'Nidovirales',
        class: 'Pisoniviricetes',
        phylum: 'Pisuviricota',
        kingdom: 'Orthornavirae',
        domain: 'Viruses',
        marker: 'Viral Diagnostic Region',
        source: 'NCBI RefSeq Viral Genomes',
        referenceStatus: 'Reference Isolate Wuhan-Hu-1',
        subRange: [21563, 23000] // Spike gene region
      },
      {
        id: 'ref-vir-flua',
        accession: 'NC_002017.1',
        organism: 'Influenza A virus',
        scientificName: 'Influenza A virus (A/Puerto Rico/8/1934(H1N1)) segment 4',
        species: 'Influenza A virus',
        genus: 'Alphainfluenzavirus',
        family: 'Orthomyxoviridae',
        order: 'Articulavirales',
        class: 'Insthoviricetes',
        phylum: 'Negarnaviricota',
        kingdom: 'Orthornavirae',
        domain: 'Viruses',
        marker: 'Hemagglutinin Segment 4',
        source: 'NCBI RefSeq Viral Genomes',
        referenceStatus: 'Reference Strain PR8'
      },
      {
        id: 'ref-vir-hiv1',
        accession: 'NC_001802.1',
        organism: 'Human immunodeficiency virus 1',
        scientificName: 'Human immunodeficiency virus 1',
        species: 'Human immunodeficiency virus 1',
        genus: 'Lentivirus',
        family: 'Retroviridae',
        order: 'Ortervirales',
        class: 'Revtraviricetes',
        phylum: 'Artverviricota',
        kingdom: 'Orthornavirae',
        domain: 'Viruses',
        marker: 'Viral Gag/Pol Region',
        source: 'NCBI RefSeq Viral Genomes',
        referenceStatus: 'Reference Strain HXB2',
        subRange: [790, 2200]
      }
    ]
  },

  // --- PHAGES ---
  {
    category: 'phages',
    indexName: 'phages-index.json',
    chunkName: 'phages-a.json',
    marker: 'Bacteriophage Diagnostic Region',
    domain: 'Viruses',
    records: [
      {
        id: 'ref-pha-lambda',
        accession: 'NC_001416.1',
        organism: 'Enterobacteria phage lambda',
        scientificName: 'Escherichia virus Lambda',
        species: 'Escherichia virus Lambda',
        genus: 'Lambdavirus',
        family: 'Siphoviridae',
        order: 'Caudoviricetes',
        class: 'Caudoviricetes',
        phylum: 'Uroviricota',
        kingdom: 'Heunggongvirae',
        domain: 'Viruses',
        marker: 'Phage Coat / Major Capsid',
        source: 'NCBI RefSeq Viral Genomes',
        referenceStatus: 'Reference Strain Lambda',
        subRange: [19000, 20500] // Gene E major capsid
      },
      {
        id: 'ref-pha-phix174',
        accession: 'NC_001422.1',
        organism: 'Enterobacteria phage phiX174',
        scientificName: 'Escherichia virus phiX174',
        species: 'Escherichia virus phiX174',
        genus: 'Sinsheimervirus',
        family: 'Microviridae',
        order: 'Petitvirales',
        class: 'Malgrandaviricetes',
        phylum: 'Phixviricota',
        kingdom: 'Monodnaviria',
        domain: 'Viruses',
        marker: 'Phage Capsid / Major Coat',
        source: 'NCBI RefSeq Viral Genomes',
        referenceStatus: 'Sanger Sequencing Standard Isolate',
        subRange: [1, 1500]
      },
      {
        id: 'ref-pha-t4',
        accession: 'NC_000866.4',
        organism: 'Enterobacteria phage T4',
        scientificName: 'Escherichia virus T4',
        species: 'Escherichia virus T4',
        genus: 'Tequatrovirus',
        family: 'Straboviridae',
        order: 'Caudoviricetes',
        class: 'Caudoviricetes',
        phylum: 'Uroviricota',
        kingdom: 'Heunggongvirae',
        domain: 'Viruses',
        marker: 'Major Capsid Gene 23',
        source: 'NCBI RefSeq Viral Genomes',
        referenceStatus: 'Reference Strain T4',
        subRange: [80000, 81500]
      }
    ]
  }
];

async function fetchFasta(accession) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${accession}&rettype=fasta&retmode=text`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${accession}`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  const seq = lines.slice(1).map(l => l.trim()).join('');
  return seq.toUpperCase();
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('=== Curating Authentic Biological Reference Database from NCBI ===\n');

  for (const group of REGISTRY) {
    const groupDir = path.join(DATA_DIR, group.category);
    fs.mkdirSync(groupDir, { recursive: true });

    console.log(`Processing ${group.category} (${group.records.length} records)...`);
    const fullRecords = [];

    for (const rec of group.records) {
      console.log(`  Fetching ${rec.accession} (${rec.organism})...`);
      try {
        let seq = await fetchFasta(rec.accession);
        if (rec.subRange) {
          const [start, end] = rec.subRange;
          seq = seq.substring(start - 1, end);
        }
        rec.sequence = seq;
        rec.sequenceLength = seq.length;
        fullRecords.push(rec);
        await sleep(350); // respect NCBI API guidelines
      } catch (err) {
        console.error(`  ERROR fetching ${rec.accession}:`, err.message);
      }
    }

    // Write chunk file
    const chunkPath = path.join(groupDir, group.chunkName);
    fs.writeFileSync(chunkPath, JSON.stringify(fullRecords, null, 2));
    console.log(`  -> Wrote chunk: ${chunkPath} (${fullRecords.length} records)`);

    // Write index file
    const indexPath = path.join(groupDir, group.indexName);
    const indexData = {
      marker: group.marker,
      domain: group.domain,
      totalRecords: fullRecords.length,
      chunks: [group.chunkName],
      records: fullRecords.map(r => ({
        id: r.id,
        accession: r.accession,
        organism: r.organism,
        scientificName: r.scientificName,
        genus: r.genus,
        species: r.species,
        sequenceLength: r.sequenceLength,
        chunk: group.chunkName
      }))
    };
    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
    console.log(`  -> Wrote index: ${indexPath}\n`);
  }

  // Create taxonomy directory and global taxonomy index
  const taxDir = path.join(DATA_DIR, 'taxonomy');
  fs.mkdirSync(taxDir, { recursive: true });
  
  const allRecords = REGISTRY.flatMap(g => g.records);
  const taxonomyIndex = {
    generatedAt: new Date().toISOString(),
    totalTaxa: allRecords.length,
    taxa: allRecords.map(r => ({
      id: r.id,
      accession: r.accession,
      organism: r.organism,
      scientificName: r.scientificName,
      domain: r.domain,
      kingdom: r.kingdom,
      phylum: r.phylum,
      class: r.class,
      order: r.order,
      family: r.family,
      genus: r.genus,
      species: r.species,
      marker: r.marker
    }))
  };
  fs.writeFileSync(path.join(taxDir, 'taxonomy-index.json'), JSON.stringify(taxonomyIndex, null, 2));
  console.log(`Wrote global taxonomy index: ${path.join(taxDir, 'taxonomy-index.json')}`);

  console.log('\n=== Reference Database Successfully Curated and Built ===');
}

main().catch(err => {
  console.error('Fatal database build error:', err);
  process.exit(1);
});
