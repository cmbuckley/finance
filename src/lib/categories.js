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
    if (transaction.transaction_classification &&
        transaction.transaction_classification.length == 2 &&
        truelayer[transaction.transaction_classification[0]]
    ) {
        return truelayer[transaction.transaction_classification[0]][transaction.transaction_classification[1]];
    }

    if (transaction.transaction_category && truelayer[transaction.transaction_category]) {
        return truelayer[transaction.transaction_category];
    }

    return Object.keys(truelayer.descriptions).find(function (match) {
        return matchesPattern(transaction.description, truelayer.descriptions[match]);
    });
}

function matchesPattern(value, pattern) {
    return (pattern instanceof RegExp ? pattern.test(value) : value.includes(pattern));
}

function lookup(key, matches, defaultResponse) {
    return function (transaction) {
        let isFunction   = (typeof defaultResponse === 'function'),
            defaultFunc  = (isFunction ? defaultResponse : function () {}),
            defaultValue = (isFunction ? null : defaultResponse);

        return Object.keys(matches).find(function (match) {
            return matchesPattern(transaction[key], matches[match]);
        }) || defaultFunc(transaction) || defaultValue || '';
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
    accommodation:    /MOXY STRATFORD|HOTEL|Booking\.com/,
    betting:          /Betbull|SKYBET|SKY BETTING|PP ONLINE|VIRAL INTERACTIVE|PAYPAL \*BV/,
    houseImprovement: /B & Q|BARGAIN TOOLS LIMITED|SCREWFIX|WICKES|IKEA/,
    flights:          /RYANAIR/,
    parking:          /NCP |CAR PARK|PARKING|MANCHESTER AIRPORT|DONCASTER SHEFFIEL|LeedsCityCouncil|CITY OF YORK COUNC|CITIPARK|PARKMOBILE|WWW.YORK.GOV.UK|Q PARK/i,
    carService:       /R H SIRRELL|ALBA TYRES|STEVE SIRRELL/,
    rail:             /GVB|Trainline|TFL.gov|E\/TUNNEL|VIRGINTRAINS/i,
    takeaway:         /JUST[ -]EAT|DOMINO'S PIZZA|SUBWAY|DELIVEROO|GREGGS|UBER/i,
    taxi:             /UBER|bolt\.eu|AMBER|STREAMLINE|WWW.OTS-UK.CO.UK|taxi|ROADRUNNER/i,
};

const monzo = {
    mondo:         '', // legacy
    general:       '', // TODO inspect
    transfers:     '',
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
        holidays: 'Job Expenses:Flights',
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
        'Bills:Phone': 'giffgaff',
        'Computing:Domains': /101DOMAIN|123[ -]?REG|NAMECHEAP|KEY-SYSTEMS|Gandi/,
        'Computing:Software': /ITUNES|1PASSWORD|PADDLE\.COM/,
        'Computing:VPS': /AWS|52B2222845CPN/,
        'Donations': /JUSTGIVING/i,
        'House:Improvement': /TIMPSON/,
        'Insurance:Landlord': /SIMPLY BUSINESS|DL 4 BUSINESS/,
        'Leisure:Betting': patterns.betting,
        'Taxes': 'HMRC',
        'Utilities:Gas': 'BRITISH GAS',
    }, 'Bills'),
    personal_care: lookup('description', {
        'Healthcare:Dental': 'DENTAL',
        'Healthcare:Eyecare': 'CONTACT LENSES',
        'Personal Care:Hair': 'CITY IMAGE',
        'Pet Care:Vet': 'VETERINARY',
    }, 'Personal Care'),
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
        'Holiday:Travel': /Trainline|WIZZ AIR|LOT INTERNET POLAND/,
        'Nights Out:Stag Do': 'GROUPIA',
    })),
    eating_out: merchantCategory({
        'Fast Food Restaurant': 'Food:Takeaway',
        'Fried Chicken Joint':  'Food:Takeaway',
    }, lookup('description', {
        'Food': /CENTRE FILLING|UPTON GROUP|SESAME +LEEDS|MARKS&SPENCER/,
        'Food:Takeaway': patterns.takeaway,
    }, 'Food:Eating Out')),
    shopping: merchantCategory({
        'Board Shop': 'Shopping:Clothing',
        'Bookstore': 'Shopping:Books & Magazines',
        'Boutique': 'Shopping:Clothing',
        'Candy Store': 'Food',
        'Clothing Store': 'Shopping:Clothing',
        'Convenience Store': 'House', // not groceries
        'Cosmetics Shop': 'Gifts',
        'Department Store': 'Shopping:Clothing',
        'Electronics Store': 'House:Electronics',
        'Food & Drink Shop': 'Food',
        'Furniture / Home Store': 'House:Furniture',
        'Garden Center': 'House:Garden',
        'Gift Shop': 'Gifts',
        'Grocery Store': 'Food:Groceries',
        'Hardware Store': 'House:Improvement',
        'Jewelry Store': 'Gifts',
        'Miscellaneous Shop': 'House',
        'Post Office': 'Shopping:Stationery',
        'Sporting Goods Shop': 'Shopping:Sporting Goods',
        'Supermarket': 'House', // not groceries
        'Warehouse Store': 'House',
        'Women\'s Store': 'Shopping:Clothing',
        'Zoo': 'Gifts',
    }, lookup('description', {
        'Food:Alcohol': 'Veeno',
        'Gifts': /W\.KRUK|WARNER BROS STUDIOS|CAVENDISH JEWELLERS/,
        'House:Decorations': 'FLORA POINT',
        'House:Improvement': patterns.houseImprovement,
        'Leisure:Toys & Games': /LH TRADING|NINTENDO/,
        'Shopping:Clothing': /ASOS\.?COM|MULBERRY|SELFRIDGES|HARRODS|JCHOOLIM|LPP|Polo Factory Store|HARVEY NICHOLS|INTIMISSIMI|J\.CHOO|VICTORIAS SECRET|PRIMARK|KLARNA|NEXT RETAIL|TEEPUBLIC|THE OUTNET|MOSS YORK|ZARA/i,
        'Shopping:Music': /VINYL|HMV UK/i,
    })),
    cash: function (transaction) {
        if (transaction.counterparty.user_id) {
            return 'Loan';
        }
    },
    transport: merchantCategory({
        'Automotive Shop': 'Car',
        'Gas Station': 'Car:Petrol',
        'Gas Station / Garage': 'Car:Petrol',
        'Government Building': 'Car:Parking', // e.g. City of York parking
        'Parking': 'Car:Parking',
        'Train': 'Travel:Rail',
        'Train Station': 'Travel:Rail',
    }, lookup('description', {
        'Car:Parking': patterns.parking,
        'Car:Petrol': /EG HOLLINWOOD|MFG +PHOENIX|LOTOS|TESCO PFS|ADEL SF|PAY AT PUMP|PETROL|MALTHURST LIMITED|ESSO|BP /,
        'Car:Service & MOT': patterns.carService,
        'Holiday:Travel': patterns.flights,
        'Travel:Bus': /AUT BILET|MPSA|MEGABUS|STAGECOACH SERVICE|First Bus|FIRST WEST YORKSHIRE|TRANSDEV/,
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
    charity: 'Donations',
    gifts: 'Gifts',
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
        'Movies & DVDs': 'Leisure:Movies & Video Rentals',
        'Newspaper & Magazines': 'Shopping:Books & Magazines',
        'Social Club': '',
        'Sport': 'Leisure:Sporting Events',
        'Games': 'Leisure:Toys & Games'
    },
    'Education': {
        'Tuition': 'Education:Tuition',
        'Student Loan': 'Education:Student Loan',
        'Books & Supplies': 'Shopping:Books & Magazines'
    },
    'Shopping': {
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
        'Spa & Massage': 'Personal Care'
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
        'Catering': '',
        'Coffee shops': 'Food:Eating Out',
        'Delivery': 'Food:Takeaway',
        'Fast Food': 'Food:Takeaway',
        'Restaurants': 'Food:Eating Out',
        'Bars': 'Nights Out'
    },
    'Gifts & Donations': {
        'Gift': 'Gifts',
        'Charity': 'Donations'
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
        'Utilities': 'Utilities'
    },
    'Auto & Transport': {
        'Auto Insurance': 'Car:Insurance',
        'Auto Payment': 'Car:Purchase',
        'Parking': 'Car:Parking',
        'Public transport': 'Travel:Bus',
        'Service & Auto Parts': 'Car:Service & MOT',
        'Taxi': 'Travel:Taxi',
        'Gas & Fuel': 'Car:Petrol'
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
        'Bills:Security': 'SKY DIGITAL',
        'Bills:TV Licence': 'TV LICENCE',
        'Car:Breakdown': 'AA MEMBERSHIP',
        'Car:Insurance': /(MOTOR|ADMIRAL) INSURANCE/,
        'Car:Service & MOT': patterns.carService,
        'Car:Tax': 'DVLA-',
        'Education:Fees': 'Pluralsight',
        'Food:Takeaway': patterns.takeaway,
        'Food:Eating Out': /Culto/,
        'Gifts': 'Vestiaire Collecti',
        'House:Council Tax': 'LEEDS CITY COUNCIL',
        'House:Garden': 'LANGLANDS GARDEN',
        'House:Improvement': patterns.houseImprovement,
        'House:Insurance': 'LV INSURANCE',
        'House:Rent': /PRESTON BAKER|LINLEY & SIMPSON/,
        'House:Security': 'ADT - OIN ACCOUNT',
        'Nights Out':  /HOS HEADINGLEY|MANAHATTA|EAST OF ARCADIA/,
        'Pet Care:Accommodation': 'KENNELS',
        'Pet Care:Vet': 'LEEDS KIRKSTALL VE',
        'Utilities:Water': 'YORKSHIRE WATER',
    }
};

module.exports = {search};
