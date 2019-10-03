BEGIN {
    as["^CASH"] = "Cash"
    as["STUDENT LOANS CO"] = "Student Loan"
    as["HSBC CREDIT CARD"] = "Credit Card"
    as["HSBC CARD PYMT"] = "Credit Card"
    as["MTG 400188[0-9]{4}9172"] = "Mortgage"
    as["HESTVIEW"] = "Payslips"
    as["PAYPAL"] = "PayPal"
    as["MONZO"] = "Monzo"
    as["Monzo Joint"] = "Monzo Joint"
    as["^404401 [0-9]{4}3752"] = "ISA"
    as["^404401 [0-9]{4}6458"] = "Online Saver" # Closed
    as["^404401 [0-9]{4}8681"] = "Online Bonus Saver"
    as["^404401 [0-9]{4}6646"] = "Regular Saver"
    as["BUCKLEY C M *RSB REGULAR SAVER"] = "Regular Saver"
    as["^404401 [0-9]{4}5471"] = "Current Account"
    as["MORTGAGE PAYMENT"] = "Current Account"
    as["BUCKLEY CM"] = "Current Account"
    as["CAPITA IRG BUCKLE"] = "Sharesave"
    as["BUCKLEY C   \\*LY[AP]"] = "ISA"
    as["BUCKLEY C SHARED ACCOUNT"] = "Shared Account"
}
{
    x = substr($0, 1, 1)

    if (x ~ "[MP]") {
        m = substr($0, 2)

        for (a in as) {
            if (m == a || m ~ a) {
                print "L[" as[a] "]"
                break
            }
        }

        print "M" m
    } else if (x != "L") {
        print
    }
}
