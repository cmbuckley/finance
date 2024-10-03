function search(transaction) {
    // monzo
    if (transaction.category) {
        let category = (monzo.hasOwnProperty(transaction.category)
                     ? monzo[transaction.category]
                     : transaction.category);

        if (typeof category == 'function') {
            category = category(transaction);
        }

        return category;
    }

    // truelayer
    if (transaction.description) {
        const category = Object.keys(truelayer.descriptions).find(function (match) {
            return matchesPattern(transaction.description, truelayer.descriptions[match]);
        });

        if (category) return category;
    }

    if (transaction.transaction_classification &&
        truelayer[transaction.transaction_classification[0]] &&
        truelayer[transaction.transaction_classification[0]][transaction.transaction_classification[1] || '']
    ) {
        return truelayer[transaction.transaction_classification[0]][transaction.transaction_classification[1] || ''];
    }

    if (transaction.transaction_category && truelayer[transaction.transaction_category]) {
        return truelayer[transaction.transaction_category];
    }
}

function matchesPattern(value, pattern) {
    return (pattern instanceof RegExp ? pattern.test(value) : value.includes(pattern));
}

function lookup(key, matches, defaultValue) {
    return function (transaction) {
        const lookup     = key.split('.').reduce((v, k) => v[k] || '', transaction),
            defaultCheck = (typeof defaultValue == 'function' ? defaultValue : () => defaultValue);

        return Object.keys(matches).find(function (match) {
            return matchesPattern(lookup, matches[match]);
        }) || defaultCheck(transaction) || '';
    };
}

function merchantCategory(matches, defaultValue) {
    return function (transaction) {
        if (transaction.category) {
            if (matches[transaction.category]) {
                return matches[transaction.category];
            }
        }

        if (transaction.merchant) {
            if (transaction.merchant.metadata &&
                matches[transaction.merchant.metadata.foursquare_category]
            ) {
                return matches[transaction.merchant.metadata.foursquare_category];
            }

            if (transaction.merchant.category && matches[transaction.merchant.category]) {
                return matches[transaction.merchant.category];
            }
        }

        return (typeof defaultValue == 'function') ? defaultValue(transaction) : defaultValue;
    };
}

// reusable patterns
const patterns = {
    accommodation:    /MOXY |HOTEL|Booking\.com|AIRBNB/i,
    betting:          /Betbull|SKYBET|SKY BETTING|PP ONLINE|VIRAL INTERACTIVE|PAYPAL \*BV/,
    houseImprovement: /B & Q|BARGAIN TOOLS LIMITED|SCREWFIX|WICKES|IKEA|HARDWAR/,
    flights:          /RYANAIR/,
    parking:          /NCP |CAR PARK|PARKING|Q-PARK|MANCHESTER AIRPORT|DONCASTER SHEFFIEL|LeedsCityCouncil|CITY OF YORK|CITIPARK|PARKMOBILE|WWW.YORK.GOV.UK|Q PARK|PAYBYPHONE|HARROGATE BOROUGH COUN|Manchester City Coun|North Yorkshire Coun/i,
    carService:       /R H SIRRELL|ALBA TY(RES|LEEDS)|STEVE SIRRELL/,
    rail:             /GVB|Trainline|TFL.gov|E\/TUNNEL|VIRGINTRAINS|LNER|NORTHERN TRAINS|CROSSCOUNTRY/i,
    takeaway:         /JUST[ -]EAT|DOMINO'S PIZZA|SUBWAY|DELIVEROO|GREGGS|UBER|MCDONALDS/i,
    taxi:             /UBER|bolt\.eu|AMBER|STREAMLINE|WWW.OTS-UK.CO.UK|taxi|ROADRUNNER/i,
    pregnancy:        /SERAPHINE|MAMAS & PAPAS|MIRACLE INSIDE/,
};

const monzo = {
    mondo:         '', // legacy
    general:       '', // TODO inspect
    transfers:     'Bills',
    savings:       '', // TODO
    groceries:     'Food:Groceries',

    expenses: merchantCategory({
        'Bus Line': 'Job Expenses:Rail',
        'Gourmet Shop': 'Job Expenses:Food',
        'Hotel': 'Job Expenses:Accommodation',
        'Parking': 'Job Expenses:Parking',
        'Train': 'Job Expenses:Rail',
        'Train Station': 'Job Expenses:Rail',
        'Supermarket': 'Job Expenses:Food',

        entertainment: 'Job Expenses:Entertainment',
        eating_out: 'Job Expenses:Food',
        groceries: 'Job Expenses:Food',
    }, lookup('description', {
        'Job Expenses:Accommodation': patterns.accommodation,
        'Job Expenses:Flights': patterns.flights,
        'Job Expenses:Parking': patterns.parking,
        'Job Expenses:Rail': patterns.rail,
        'Job Expenses:Taxi': patterns.taxi,
    }, 'Job Expenses')),
    bills: lookup('description', {
        'Bills:HomeCare': '910010492987',
        'Bills:Phone': 'giffgaff',
        'Computing:Domains': /101DOMAIN|123[ -]?REG|NAMECHEAP|KEY-SYSTEMS|Gandi|CLOUDFLARE/,
        'Computing:Software': /ITUNES|1PASSWORD|PADDLE\.COM/,
        'Computing:VPS': /AWS|52B2222845CPN/,
        'Gifts & Donations:Charity': /JUSTGIVING/i,
        'House:Improvement': /TIMPSON/,
        'Insurance:Landlord': /SIMPLY BUSINESS|DL 4 BUSINESS/,
        'Leisure:Betting': patterns.betting,
        'Taxes': 'HMRC',
        'Utilities:Gas': 'BRITISH GAS',
    }, 'Bills'),
    personal_care: lookup('counterparty.name', {
        'Healthcare': 'Mental Health',
    }, lookup('description', {
        'Healthcare:Dental': 'DENTAL',
        'Healthcare:Eyecare': 'CONTACT LENSES',
        'Healthcare:Pharmacy': /PHARMACY/i,
        'Personal Care:Hair': 'CITY IMAGE',
        'Pet Care:Vet': 'VETERINARY',
    }, 'Personal Care')),
    entertainment: merchantCategory({
        'Zoo': 'Leisure:Activities',
    }, lookup('description', {
        'Leisure:Activities': /ACTIVE NETWORK|TOUGH MUDDER/,
        'Leisure:Betting': patterns.betting,
        'Leisure:Cinema': 'CINEMA',
        'Leisure:Climbing': 'CLIMBING',
        'Leisure:Music Events': /RECORDS|TICKETMASTER|SHEFFIELDSTUDENTSU/,
        'Leisure:Snowboarding': 'SNOZONE',
    }, 'Nights Out')),
    holidays: merchantCategory({
        'Art Museum': 'Holiday:Activities',
        'Hotel': 'Holiday:Accommodation',
        'Post Office': 'Holiday',
        'Vineyard': 'Holiday:Accommodation',
    }, lookup('description', {
        'Car:Parking': patterns.parking,
        'Food:Eating Out': 'HMSHOST',
        'Holiday:Accommodation': patterns.accommodation,
        'Holiday:Souvenirs': 'WDFG',
        'Holiday:Travel': /Trainline|WIZZ AIR|LOT INTERNET POLAND|RYANAIR/i,
        'Nights Out:Stag Do': 'GROUPIA',
    })),
    eating_out: merchantCategory({
        'Fast Food Restaurant': 'Food:Takeaway',
        'Fried Chicken Joint':  'Food:Takeaway',
    }, lookup('description', {
        'Food': /CENTRE FILLING|UPTON GROUP|SESAME +LEEDS|MARKS&SPENCER/,
        'Food:Coffee Shops & Bakeries': /COFFEE|STARBUCKS/,
        'Food:Takeaway': patterns.takeaway,
    }, 'Food:Eating Out')),
    shopping: merchantCategory({
        'Board Shop': 'Shopping:Clothing',
        'Bookstore': 'Shopping:Books & Magazines',
        'Boutique': 'Shopping:Clothing',
        'Candy Store': 'Food',
        'Clothing Store': 'Shopping:Clothing',
        'Convenience Store': 'House', // not groceries
        'Cosmetics Shop': 'Gifts & Donations:Gifts',
        'Department Store': 'Shopping:Clothing',
        'Electronics Store': 'House:Electronics',
        'Food & Drink Shop': 'Food',
        'Furniture / Home Store': 'House:Furniture',
        'Garden Center': 'House:Garden',
        'Gift Shop': 'Gifts & Donations:Gifts',
        'Grocery Store': 'Food:Groceries',
        'Hardware Store': 'House:Improvement',
        'Jewelry Store': 'Gifts & Donations:Gifts',
        'Miscellaneous Shop': 'House',
        'Post Office': 'Shopping:Stationery',
        'Sporting Goods Shop': 'Shopping:Sporting Goods',
        'Supermarket': 'House', // not groceries
        'Warehouse Store': 'House',
        'Women\'s Store': 'Shopping:Clothing',
        'Zoo': 'Gifts & Donations:Gifts',
    }, lookup('description', {
        'Food:Alcohol': 'Veeno',
        'Gifts & Donations:Gifts': /W\.KRUK|WARNER BROS STUDIOS|CAVENDISH JEWELLERS|Etsy/,
        'Healthcare:Pregnancy & Maternity': patterns.pregnancy,
        'House:Decorations': /FLORA POINT|PLANTS|Dunelm Soft/,
        'House:Improvement': patterns.houseImprovement,
        'Leisure:Toys & Games': /LH TRADING|NINTENDO/,
        'Shopping:Clothing': /ASOS\.?COM|MULBERRY|SELFRIDGES|HARRODS|JCHOOLIM|LPP|Polo Factory Store|HARVEY NICHOLS|INTIMISSIMI|J\.CHOO|VICTORIAS SECRET|PRIMARK|KLARNA|NEXT RETAIL|TEEPUBLIC|THE OUTNET|MOSS YORK|ZARA|T K MAXX|SHOES|Hennes Mauritz|TED BAKER/i,
        'Entertainment:Music': /VINYL|HMV UK/i,
        'Shopping:Stationery': 'POST OFFICE',
    })),
    cash: function (transaction) {
        if (transaction.counterparty.user_id) {
            return 'Loan';
        }
    },
    transport: merchantCategory({
        'Automotive Shop': 'Car',
        'Gas Station': 'Car:Fuel',
        'Gas Station / Garage': 'Car:Fuel',
        'Government Building': 'Car:Parking', // e.g. City of York parking
        'Parking': 'Car:Parking',
        'Train': 'Travel:Rail',
        'Train Station': 'Travel:Rail',
    }, lookup('description', {
        'Car': /HMCOURTS/,
        'Car:Fuel': /EG HOLLINWOOD|MFG +PHOENIX|LOTOS|TESCO PFS|ADEL SF|PAY AT PUMP|PETROL|MALTHURST LIMITED|ESSO|BP |WELCOME BREAK/,
        'Car:Parking': patterns.parking,
        'Car:Repair': 'AUTOGLASS',
        'Car:Service & MOT': patterns.carService,
        'Holiday:Travel': patterns.flights,
        'Travel:Bus': /AUT BILET|MPSA|MEGABUS|STAGECOACH SERVICE|First Bus|FIRST WEST YORKSHIRE|TRANSDEV|BUS TICKET/,
        'Travel:Rail': patterns.rail,
        'Travel:Taxi': patterns.taxi,
        'Travel:Toll': /DART-CHARGE|^PPO /,
    })),
    family: merchantCategory({
        'Convenience Store': 'House',
        'Furniture / Home Store': 'House:Furniture',
        'Garden Center': 'House:Garden',
        'Hardware Store': 'House:Improvement',
        'Pet Store': 'Pet Care',
        'Supermarket': 'House',
        'Warehouse Store': 'House',
    }, lookup('description', {
        'House:Garden': /LANGLANDS|GARDEN CENTRE/,
        'House:Improvement': patterns.houseImprovement,
        'Pet Care': 'PETS AT HOME',
        'Pet Care:Accommodation': /MANSTON PET HOTEL|PAWSHAKE/,
        'Pet Care:Food': /ZooPlus/i,
        'Pet Care:Vet': /VETERINARY|VETS4P/,
    })),
    charity: 'Gifts & Donations:Charity',
    gifts: 'Gifts & Donations:Gifts',
};

const truelayer = {
    'Uncategorized': {
        'Cash & ATM': '',
        'Check': ''
    },
    'Entertainment': {
        'Arts': 'Leisure:Arts & Culture',
        'Music': 'Leisure:Music Events',
        'Dating': '',
        'Movies & DVDs': 'Bills:TV Subscription', // Netflix
        'Newspaper & Magazines': 'Entertainment:Newspaper & Magazines',
        'Outdoors': 'Leisure:Activities',
        'Social Club': '',
        'Sport': 'Leisure:Sporting Events',
        'Games': 'Leisure:Toys & Games'
    },
    'Education': {
        'Tuition': 'Education:Tuition',
        'Student Loan': 'Education:Student Loan',
        'Books & Supplies': 'Education:Books & Suppliers'
    },
    'Shopping': {
        '': 'Shopping',
        'Pets': 'Pet Care',
        'Groceries': 'Food:Groceries',
        'General': 'Shopping',
        'Clothing': 'Shopping:Clothing',
        'Home': 'House',
        'Books': 'Shopping:Books & Magazines',
        'Electronics & Software': 'Computing:Electronics',
        'Hobbies': 'Shopping:Hobbies',
        'Sporting Goods': 'Shopping:Sporting Goods'
    },
    'Personal Care': {
        'Hair': 'Personal Care:Hair',
        'Laundry': '',
        'Beauty': 'Personal Care',
        'Spa & Massage': 'Personal Care:Spa & Massage'
    },
    'Health & Fitness': {
        'Dentist': 'Healthcare:Dental',
        'Doctor': 'Healthcare',
        'Eye care': 'Healthcare:Eyecare',
        'Pharmacy': 'Healthcare:Pharmacy',
        'Gym': 'Healthcare:Fitness',
        'Pets': 'Pet Care',
        'Sports': ''
    },
    'Food & Dining': {
        '': 'Food',
        'Catering': '',
        'Coffee shops': 'Food:Eating Out',
        'Delivery': 'Food:Takeaway',
        'Fast Food': 'Food:Takeaway',
        'Restaurants': 'Food:Eating Out',
        'Bars': 'Nights Out'
    },
    'Gifts & Donations': {
        'Gift': 'Gifts & Donations:Gifts',
        'Charity': 'Gifts & Donations:Charity'
    },
    'Investments': {
        'Equities': '',
        'Bonds': '',
        'Bank products': '',
        'Retirement': '',
        'Annuities': '',
        'Real-estate': ''
    },
    'Bills and Utilities': {
        'Television': 'Bills:TV Licence',
        'Home Phone': 'Bills:Phone',
        'Internet': 'Bills:Internet',
        'Mobile Phone': 'Bills:Phone',
        'Utilities': 'Utilities',
    },
    'Auto & Transport': {
        'Auto Insurance': 'Car:Insurance',
        'Parking': 'Car:Parking',
        'Public transport': 'Travel:Bus',
        'Service & Auto Parts': 'Car:Service & MOT',
        'Taxi': 'Travel:Taxi',
        'Gas & Fuel': 'Car:Fuel'
    },
    'Travel': {
        'Air Travel': 'Holiday:Travel',
        'Hotel': 'Holiday:Accommodation',
        'Rental Car & Taxi': 'Holiday:Travel',
        'Vacation': 'Holiday'
    },
    'Fees & Charges': {
        'Service Fee': 'Bank Charges:Service Charge',
        'Late Fee': 'Bank Charges:Service Charge',
        'Finance Charge': 'Bank Charges:Service Charge',
        'ATM Fee': 'Bank Charges:ATM Charge',
        'Bank Fee': 'Bank Charges:Service Charge',
        'Commissions': 'Bank Charges:Service Charge'
    },
    'Business Services': {
        'Advertising': '',
        'Financial Services': '',
        'Office Supplies': '',
        'Printing': '',
        'Shipping': '',
        'Legal': ''
    },
    'Personal Services': {
        'Advisory and Consulting': '',
        'Financial Services': '',
        'Lawyer': '',
        'Repairs & Maintenance': ''
    },
    'Taxes': {
        'Federal Tax': '',
        'State Tax': '',
        'Local Tax': '',
        'Sales Tax': '',
        'Property Tax': ''
    },
    'Gambling': {
        'Betting': 'Leisure:Betting',
        'Lottery': '',
        'Casino': ''
    },
    'Home': {
        'Rent': 'House:Rent',
        'Mortgage': 'House:Mortgage',
        'Secured loans': '',
        'Pension and insurances': '',
        'Pension payments': '',
        'Life insurance': '',
        'Buildings and contents insurance': 'House:Insurance',
        'Health insurance': ''
    },

    'INTEREST': 'Bank Charges:Interest',

    descriptions: {
        'Bank Charges:Service Charge': 'Transaction Fee',
        'Bills:Sky': 'SKY DIGITAL',
        'Bills:TV Licence': 'TV LICENCE',
        'Car:Breakdown': 'AA MEMBERSHIP',
        'Car:Insurance': /(MOTOR|ADMIRAL) INSURANCE/,
        'Car:Service & MOT': patterns.carService,
        'Car:Tax': 'DVLA-',
        'Car:Toll': /DART-CHARGE|TOLL|^PPO/,
        'Education:Fees': 'Pluralsight',
        'Food:Takeaway': patterns.takeaway,
        'Food:Eating Out': /Culto|THE OWL/,
        'Gifts': 'Vestiaire Collecti',
        'Job Expenses': 'Answer Expenses',
        'Healthcare:Dental': 'DENTAL',
        'Healthcare:Pregnancy & Maternity': patterns.pregnancy,
        'House:Council Tax': 'LEEDS CITY COUNCIL',
        'House:Garden': 'LANGLANDS GARDEN',
        'House:Improvement': patterns.houseImprovement,
        'House:Insurance': 'LV INSURANCE',
        'House:Security': 'ADT - OIN ACCOUNT',
        'Income:Rental Income': /PRESTON BAKER|LINLEY & SIMPSON/,
        'Nights Out':  /HOS HEADINGLEY|MANAHATTA|EAST OF ARCADIA|Terminus/,
        'Pet Care:Accommodation': 'KENNELS',
        'Pet Care:Vet': 'LEEDS KIRKSTALL VE',
        'Travel:Rail': patterns.rail,
        'Utilities:Water': 'YORKSHIRE WATER',
    }
};

module.exports = {search};
